/**
 * sop_response.ts — Constructores de Respuesta SOP
 * Trazabilidad: TSK-I1-B02-RF — "aplicacion de helpers de respuesta"
 * Agente: backend-coder
 *
 * Responsabilidad unica: serializar respuestas conformes al SOP definido en
 * PROJECT_spec.md. Ningun otro modulo debe construir JSON de respuesta a mano.
 */

import type { DependencyStatus, ConnectionStatus, ConfigStatus, ServiceName, ErrorCode } from '@/src/lib/types/health_types';

// Re-exportar tipos de dominio para que los consumidores de sop_response
// tengan acceso completo desde un solo punto de importacion.
export type { ConnectionStatus, ConfigStatus, ServiceName, ErrorCode };

// =============================================================================
// Tipos de respuesta (espejo del contrato TS en PROJECT_spec.md)
// =============================================================================

interface SopBase {
  status: 'healthy' | 'unhealthy';
  version: string;
  timestamp: string;
}

export interface PublicHealthResponse extends SopBase {
  status: 'healthy';
}

export interface PrivateHealthResponse extends SopBase {
  status: 'healthy';
  performance: {
    api_latency_ms: number;
    latency_type: string;
  };
  dependencies: {
    database: ConnectionStatus;
    redis: ConnectionStatus;
    email_service: ConfigStatus;
    captcha_service: ConfigStatus;
  };
}

export interface ErrorHealthResponse extends SopBase {
  status: 'unhealthy';
  error_code: ErrorCode;
  message: string;
  unhealthy_services?: ServiceName[];
}

// =============================================================================
// Helpers de construccion
// =============================================================================

/** Version de la aplicacion — constante para responder incluso sin DB */
const APP_VERSION = '1.0.0';

/** Genera el timestamp SOP: ISO-8601 UTC con milisegundos */
function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Formatea la latencia como float con exactamente 2 decimales.
 * Garantiza que el JSON serializado incluya siempre `.XX`.
 */
export function formatLatency(rawMs: number): number {
  return parseFloat(rawMs.toFixed(2));
}

/**
 * Construye una respuesta 200 OK en modo publico (sin X-Health-Key o llave incorrecta).
 * Solo expone status, version y timestamp.
 */
export function buildPublicSuccessResponse(): PublicHealthResponse {
  return {
    status: 'healthy',
    version: APP_VERSION,
    timestamp: nowISO(),
  };
}

/**
 * Construye una respuesta 200 OK en modo privado (X-Health-Key valida).
 * Incluye performance y estado de todas las dependencias.
 */
export function buildPrivateSuccessResponse(
  latencyMs: number,
  deps: DependencyStatus
): PrivateHealthResponse {
  return {
    status: 'healthy',
    version: APP_VERSION,
    timestamp: nowISO(),
    performance: {
      api_latency_ms: formatLatency(latencyMs),
      latency_type: 'Server-side processing (including DB/Redis check)',
    },
    dependencies: {
      database: deps.database,
      redis: deps.redis,
      email_service: deps.email_service,
      captcha_service: deps.captcha_service,
    },
  };
}

/**
 * Construye una respuesta de error conforme al catalogo SOP.
 * Opcionalmente incluye `unhealthy_services` para el codigo SYSTEM_DEGRADED.
 */
export function buildErrorResponse(
  errorCode: ErrorCode,
  message: string,
  unhealthyServices?: ServiceName[]
): ErrorHealthResponse {
  const response: ErrorHealthResponse = {
    status: 'unhealthy',
    version: APP_VERSION,
    timestamp: nowISO(),
    error_code: errorCode,
    message,
  };
  if (unhealthyServices && unhealthyServices.length > 0) {
    response.unhealthy_services = unhealthyServices;
  }
  return response;
}
