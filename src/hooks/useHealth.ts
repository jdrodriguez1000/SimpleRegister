/**
 * useHealth.ts — Hook y Lógica Pura de Estado: Health Dashboard
 * Trazabilidad: TSK-I1-F02-G / TSK-I1-F02-RF | Iteración 1 — Bloque 5
 * Agente: frontend-coder
 *
 * Estructura de exports:
 *   - Tipo:           HealthState, UseHealthReturn
 *   - Funciones puras (testeables en Node, TSK-I1-F02-R):
 *       computeSLALevel · getInitialState · applyHealthResponse
 *   - Hook React:     useHealth (requiere contexto de Client Component)
 *
 * Datos: vinculado a Mocks del spec §Contrato de Mocks.
 * Conexión real a la API: TSK-I1-F03-G.
 */

import { useState, useEffect, useCallback } from 'react';
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
// Mock de la API — Spec §Contrato de Mocks (Respuesta Privada — Success Full)
// Será reemplazado por la capa de servicio real en TSK-I1-F03-G
// =============================================================================

function buildMockResponse(): HealthCheckResponse {
  return {
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    performance: {
      api_latency_ms: 45.00,
      latency_type: 'Server-side processing (including DB/Redis check)',
    },
    dependencies: {
      database: 'connected',
      redis: 'connected',
      email_service: 'config_valid',
      captcha_service: 'config_valid',
    },
  };
}

// =============================================================================
// React Hook — useHealth
// Requiere 'use client' en el componente que lo consuma.
// =============================================================================

export function useHealth(): UseHealthReturn {
  const [state, setState] = useState<HealthState>(getInitialState);

  const fetchHealth = useCallback(() => {
    setState(prev => ({ ...prev, uiState: 'loading' }));

    // Simula latencia de red con mock — reemplazar en TSK-I1-F03-G
    const timer = setTimeout(() => {
      const response = buildMockResponse();
      setState(prev => applyHealthResponse(prev, response));
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return fetchHealth();
  }, [fetchHealth]);

  return { state, refetch: fetchHealth };
}
