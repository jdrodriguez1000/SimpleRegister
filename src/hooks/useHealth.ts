/**
 * useHealth.ts — Hook y Lógica Pura de Estado: Health Dashboard
 * Trazabilidad: TSK-I1-F02-G / TSK-I1-F02-RF / TSK-I1-F03-RF | Iteración 1 — Bloques 5–6
 * Agente: frontend-coder
 *
 * Estructura de exports:
 *   - Tipo:           HealthState, UseHealthReturn
 *   - Funciones puras (testeables en Node, TSK-I1-F02-R):
 *       computeSLALevel · getInitialState · applyHealthResponse
 *   - Hook React:     useHealth (requiere contexto de Client Component)
 *
 * Datos: consume /api/v1/health real vía health_api_client (TSK-I1-F03-G/RF).
 * Resiliencia: reintento exponencial automático ante 503/429 (centralizado en service layer).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchHealthWithRetry,
  FetchHealthError,
} from '@/src/lib/services/health_api_client';
import type { RetryConfig } from '@/src/lib/services/health_api_client';
import type { HealthCheckResponse, SLALevel, HealthUIState } from '@/types/health';

// =============================================================================
// Tipos del Estado — Forma de la máquina de estados
// =============================================================================

/** Estado completo de la máquina del dashboard de salud */
export interface HealthState {
  /** Estado de la transición de la UI (idle → loading → success | error) */
  uiState: HealthUIState;
  /** Última respuesta recibida de la API (null si aún no se ha realizado petición) */
  data: HealthCheckResponse | null;
  /** Nivel SLA calculado de la latencia (null si no hay datos de performance) */
  slaLevel: SLALevel | null;
  /** Código de error de la API o mensaje de fallo de red (null si no hay error) */
  error: string | null;
  /** Timestamp de la última petición completada (null si aún no hubo petición) */
  lastFetchedAt: Date | null;
}

export interface UseHealthReturn {
  state: HealthState;
  refetch: () => void;
}

// =============================================================================
// Funciones Puras — testeables sin contexto React (satisfacen TSK-I1-F02-R)
// =============================================================================

/**
 * Clasifica la latencia según los umbrales SLA de PROJECT_spec.md
 * §Criterios de Degradación:
 *   green:    api_latency_ms < 200
 *   warning:  200 ≤ api_latency_ms < 500
 *   critical: api_latency_ms ≥ 500
 */
export function computeSLALevel(latencyMs: number): SLALevel {
  if (latencyMs < 200) return 'green';
  if (latencyMs < 500) return 'warning';
  return 'critical';
}

/**
 * Retorna el estado inicial de la máquina.
 * Determinista: siempre produce la misma estructura con todos los campos null.
 */
export function getInitialState(): HealthState {
  return {
    uiState: 'idle',
    data: null,
    slaLevel: null,
    error: null,
    lastFetchedAt: null,
  };
}

/**
 * Transición pura de estado a partir de una respuesta de la API.
 *
 * healthy  → success (slaLevel computado si hay campo performance)
 * unhealthy → error  (slaLevel: critical, error: error_code del response)
 *
 * Inmutabilidad garantizada: usa spread, no muta el estado de entrada.
 */
export function applyHealthResponse(
  state: HealthState,
  response: HealthCheckResponse
): HealthState {
  if (response.status === 'healthy') {
    const slaLevel =
      response.performance != null
        ? computeSLALevel(response.performance.api_latency_ms)
        : null;

    return {
      ...state,
      uiState: 'success',
      data: response,
      slaLevel,
      error: null,
      lastFetchedAt: new Date(),
    };
  }

  // response.status === 'unhealthy'
  return {
    ...state,
    uiState: 'error',
    data: response,
    slaLevel: 'critical',
    error: response.error_code,
    lastFetchedAt: new Date(),
  };
}

// =============================================================================
// Configuración de Resiliencia — política de reintento del hook
// spec §Manejo de Estados UI — Error: reintento con backoff exponencial
// =============================================================================

const HEALTH_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1_000,
};

// =============================================================================
// React Hook — useHealth
// Requiere 'use client' en el componente que lo consuma.
// Consume /api/v1/health real vía fetchHealthWithRetry (TSK-I1-F03-G).
// =============================================================================

export function useHealth(apiKey?: string): UseHealthReturn {
  const [state, setState] = useState<HealthState>(getInitialState);
 
  const executeFetch = useCallback(() => {
    setState(prev => ({ ...prev, uiState: 'loading' }));
 
    const controller = new AbortController();
 
    fetchHealthWithRetry({ apiKey, signal: controller.signal }, HEALTH_RETRY_CONFIG)
      .then(({ data }) => {
        setState(prev => applyHealthResponse(prev, data));
      })
      .catch((err: unknown) => {
        // Cancelación intencional (cleanup de useEffect) — no actualizar estado
        if (err instanceof Error && err.name === 'AbortError') return;

        if (err instanceof FetchHealthError && err.response != null) {
          // Error HTTP con body SOP — mapear directamente a estado de error
          setState(prev => applyHealthResponse(prev, err.response!));
        } else {
          // Fallo de red puro (statusCode 0) o error inesperado — degradar a error
          setState(prev => ({
            ...prev,
            uiState: 'error',
            slaLevel: 'critical',
            error: 'SYSTEM_DEGRADED',
            lastFetchedAt: new Date(),
          }));
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    return executeFetch();
  }, [executeFetch]);

  return { state, refetch: executeFetch };
}
