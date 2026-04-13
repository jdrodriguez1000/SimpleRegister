/**
 * health_api_client.ts — Servicio de API Real: Health Dashboard
 * Trazabilidad: TSK-I1-F03-G / TSK-I1-F03-RF | Iteración 1 — Bloque 6
 * Agente: frontend-coder
 *
 * Responsabilidades:
 *   - Consumir GET /api/v1/health con los headers contractuales de la Spec.
 *   - Traducir respuestas HTTP no-2xx a FetchHealthError estructurado.
 *   - Centralizar la lógica de reintento exponencial (shouldRetry, buildExponentialDelay).
 *   - Exponer fetchHealthWithRetry como punto de integración con useHealth.
 *
 * Trazabilidad de contratos:
 *   - URL:          PROJECT_spec.md §URL Base (Development): http://localhost:3000
 *   - Headers:      PROJECT_spec.md §Esquema de Request: Accept, X-Health-Key
 *   - Errores HTTP: PROJECT_spec.md §Errors: 400, 403, 406, 429, 503
 *   - Retry:        PROJECT_spec.md §Manejo de Estados UI — Error: backoff exponencial
 */

import type { HealthCheckResponse } from '@/types/health';

// =============================================================================
// Endpoint — constante canónica del recurso de salud
// =============================================================================

const HEALTH_ENDPOINT = '/api/v1/health';

// =============================================================================
// Tipos de Contrato — exportados para uso en hooks y tests
// =============================================================================

/** Opciones de configuración para fetchHealth */
export interface FetchHealthOptions {
  /** UUID v4 para acceso privado (X-Health-Key). Omitir para modo público. */
  apiKey?: string;
  /** AbortSignal para cancelar la petición (ej. cleanup de useEffect). */
  signal?: AbortSignal;
}

/** Configuración de la política de reintentos */
export interface RetryConfig {
  /** Número máximo de reintentos tras el intento original. */
  maxRetries: number;
  /** Delay base en ms para el cálculo de backoff exponencial. */
  baseDelayMs: number;
}

/** Resultado de fetchHealthWithRetry incluyendo metadata de reintentos */
export interface FetchHealthResult {
  /** Respuesta parseada de la API de salud. */
  data: HealthCheckResponse;
  /** Número de reintentos realizados (0 = éxito en el primer intento). */
  retryCount: number;
}

// =============================================================================
// RetryConfig por defecto — aplicada cuando el consumidor no provee una
// =============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1_000,
};

// =============================================================================
// FetchHealthError — Error estructurado con metadata HTTP
// Permite a los consumidores (useHealth) mapear códigos a acciones UI globales.
// =============================================================================

export class FetchHealthError extends Error {
  /** Código de estado HTTP (0 para errores de red sin respuesta del servidor). */
  readonly statusCode: number;
  /** Código semántico del error (espejo de error_code en la Spec SOP). */
  readonly errorCode: string;
  /** Tiempo de espera recomendado antes de reintentar, en milisegundos. */
  readonly retryAfterMs: number | undefined;
  /** Body completo de la respuesta de error (null en fallos de red). */
  readonly response: HealthCheckResponse | undefined;

  constructor(
    statusCode: number,
    errorCode: string,
    message: string,
    response?: HealthCheckResponse,
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'FetchHealthError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.response = response;
    this.retryAfterMs = retryAfterMs;
    // Necesario para que instanceof funcione en TypeScript con targets ES5/ES2018
    Object.setPrototypeOf(this, FetchHealthError.prototype);
  }
}

// =============================================================================
// shouldRetry — decisión pura de reintento por statusCode
// spec §Manejo de Estados UI: reintento automático en caso de 503/429
// =============================================================================

/**
 * Determina si un código de estado HTTP amerita un reintento automático.
 *
 * Reintentables:
 *   - 429 RATE_LIMIT_EXCEEDED: el servidor puede recuperarse tras esperar
 *   - 503 SYSTEM_DEGRADED:     fallo transitorio de servicios críticos
 *   - 0   (fallo de red):      ausencia de respuesta del servidor
 *
 * No reintentables:
 *   - 400 MALFORMED_REQUEST:   error del cliente — reintentar no ayuda
 *   - 403 AUTH_REQUIRED:       llave inválida — reintentar con la misma llave falla
 *   - 406 CONTENT_TYPE:        header Accept incorrecto — error de configuración
 */
export function shouldRetry(statusCode: number): boolean {
  return statusCode === 429 || statusCode === 503 || statusCode === 0;
}

// =============================================================================
// buildExponentialDelay — cálculo puro de backoff exponencial
// spec §TSK-I1-F03-G: reintento con backoff exponencial
// =============================================================================

/**
 * Calcula el delay de espera antes del siguiente reintento.
 *
 * Fórmula: baseMs × 2^attempt
 *   - attempt 0 → baseMs × 1  (1000ms por defecto)
 *   - attempt 1 → baseMs × 2  (2000ms por defecto)
 *   - attempt 2 → baseMs × 4  (4000ms por defecto)
 *
 * Si retryAfterMs está definido y es mayor al delay calculado, tiene prioridad
 * (respeta el header Retry-After del servidor — spec §429).
 *
 * @param attempt     Número de intento actual (0-indexed).
 * @param baseMs      Delay base en ms (default: 1000).
 * @param retryAfterMs Delay mínimo impuesto por el servidor vía Retry-After (opcional).
 * @returns           Delay final en ms.
 */
export function buildExponentialDelay(
  attempt: number,
  baseMs = 1_000,
  retryAfterMs?: number,
): number {
  const calculated = baseMs * Math.pow(2, attempt);
  if (retryAfterMs != null && retryAfterMs > calculated) {
    return retryAfterMs;
  }
  return calculated;
}

// =============================================================================
// Helpers internos
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// fetchHealth — petición GET /api/v1/health con headers contractuales
// spec §Esquema de Request: Accept: application/json, X-Health-Key (opcional)
// =============================================================================

/**
 * Realiza una petición GET al endpoint de salud con los headers definidos
 * en PROJECT_spec.md.
 *
 * Modos de acceso:
 *   - Público  (sin apiKey): devuelve solo status, version, timestamp.
 *   - Privado  (con apiKey): devuelve además performance y dependencies.
 *
 * Errores:
 *   - Respuesta no-2xx → lanza FetchHealthError con statusCode y errorCode del body.
 *   - Error de red (TypeError) → lanza FetchHealthError con statusCode 0.
 *
 * @throws {FetchHealthError} En caso de respuesta de error o fallo de red.
 */
export async function fetchHealth(
  options: FetchHealthOptions = {},
): Promise<HealthCheckResponse> {
  const { apiKey, signal } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (apiKey != null) {
    headers['X-Health-Key'] = apiKey;
  }

  let response: Response;

  try {
    response = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      headers,
      signal,
    });
  } catch (networkErr) {
    const message =
      networkErr instanceof Error ? networkErr.message : 'Error de red desconocido';
    throw new FetchHealthError(0, 'SYSTEM_DEGRADED', message);
  }

  if (!response.ok) {
    // Extraer Retry-After si lo incluye el servidor (spec §429)
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterMs =
      retryAfterHeader != null ? parseInt(retryAfterHeader, 10) * 1_000 : undefined;

    // Parsear el body de error para exponer error_code y message
    let errorBody: Extract<HealthCheckResponse, { status: 'unhealthy' }>;
    try {
      errorBody = (await response.json()) as Extract<
        HealthCheckResponse,
        { status: 'unhealthy' }
      >;
    } catch {
      throw new FetchHealthError(
        response.status,
        'SYSTEM_DEGRADED',
        'Respuesta de error sin body JSON parseable',
        undefined,
        retryAfterMs,
      );
    }

    throw new FetchHealthError(
      response.status,
      errorBody.error_code,
      errorBody.message,
      errorBody,
      retryAfterMs,
    );
  }

  return (await response.json()) as HealthCheckResponse;
}

// =============================================================================
// fetchHealthWithRetry — wrapper con reintento exponencial centralizado
// spec §TSK-I1-F03-G DoD: "reintenta automáticamente en caso de 503/429"
// spec §TSK-I1-F03-RF DoD: "Lógica de reintento centralizada"
// =============================================================================

/**
 * Invoca fetchHealth con política de reintento automático para errores
 * transitorios (429, 503, red).
 *
 * Política:
 *   1. Intenta fetchHealth.
 *   2. Si falla con un statusCode reintentable y retryCount < maxRetries:
 *      - Calcula el delay (respetando Retry-After si está presente).
 *      - Espera el delay.
 *      - Reintenta.
 *   3. Si agota maxRetries, lanza el último FetchHealthError.
 *   4. Errores no reintentables (400, 403) se propagan inmediatamente.
 *
 * @param options     Opciones de fetchHealth (apiKey, signal).
 * @param retryConfig Configuración de reintentos (default: 3 reintentos, 1s base).
 * @returns           FetchHealthResult con data y número de reintentos realizados.
 * @throws {FetchHealthError} Tras agotar reintentos o ante errores no reintentables.
 */
export async function fetchHealthWithRetry(
  options: FetchHealthOptions = {},
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<FetchHealthResult> {
  let retryCount = 0;

  while (true) {
    try {
      const data = await fetchHealth(options);
      return { data, retryCount };
    } catch (err) {
      if (
        err instanceof FetchHealthError &&
        shouldRetry(err.statusCode) &&
        retryCount < retryConfig.maxRetries
      ) {
        const delay = buildExponentialDelay(
          retryCount,
          retryConfig.baseDelayMs,
          err.retryAfterMs,
        );
        await sleep(delay);
        retryCount++;
      } else {
        throw err;
      }
    }
  }
}
