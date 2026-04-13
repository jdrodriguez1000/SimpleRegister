/**
 * integration_layer.test.ts — TSK-I1-F03-R: Integration Layer Red-Check
 *
 * Propósito: Validar los contratos de la capa de servicio de API real del
 * dashboard de salud. Los tests cubren la lógica de consumo del endpoint
 * /api/v1/health, manejo de errores HTTP y resiliencia mediante reintento
 * exponencial, según PROJECT_spec.md §Manejo de Estados UI y §Sección Backend.
 *
 * ESTADO ESPERADO: RED
 *   - Cannot find module '@/src/lib/services/health_api_client' — el módulo
 *     no existe. Todos los tests fallan por error de resolución de módulo.
 *
 * Contratos que el agente frontend-coder (TSK-I1-F03-G) debe satisfacer:
 *   1. `fetchHealth(options?)` — GET /api/v1/health con headers correctos
 *   2. `FetchHealthError` — clase de error con statusCode y retryAfterMs
 *   3. `buildExponentialDelay(attempt, baseMs?, retryAfterMs?)` — función pura
 *   4. `shouldRetry(statusCode)` — decisión pura de reintento (429, 503)
 *   5. `fetchHealthWithRetry(options?, retryConfig?)` — retry con backoff
 *
 * Trazabilidad: TSK-I1-F03-R
 * Dependencia Resuelta: TSK-I1-B03-C (resiliencia BE certificada)
 *                       TSK-I1-F02-C (UI states certificados)
 * Siguiente Tarea: TSK-I1-F03-G (frontend-coder implementa service layer real)
 */

// =============================================================================
// IMPORTACIÓN CONTRACTUAL — Causa de falla en estado RED
// @/src/lib/services/health_api_client no existe → Cannot find module → RED
// =============================================================================
import {
  fetchHealth,
  fetchHealthWithRetry,
  buildExponentialDelay,
  shouldRetry,
  FetchHealthError,
} from '@/src/lib/services/health_api_client';

import type {
  FetchHealthOptions,
  RetryConfig,
  FetchHealthResult,
} from '@/src/lib/services/health_api_client';

import type { HealthCheckResponse } from '@/types/health';

// =============================================================================
// Setup Global — Mock de fetch nativo (Next.js 15 usa fetch nativo)
// =============================================================================

const mockFetch = jest.fn();

beforeAll(() => {
  global.fetch = mockFetch;
});

beforeEach(() => {
  mockFetch.mockReset();
});

afterAll(() => {
  jest.restoreAllMocks();
});

/** Construye una Response mockeada con los parámetros indicados */
function buildMockResponse(
  body: HealthCheckResponse,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    json: async () => body,
  } as unknown as Response;
}

// =============================================================================
// BLOQUE 1 — Contrato de Módulo: exports requeridos por TSK-I1-F03-G
// =============================================================================

describe('TSK-I1-F03-R | Contrato de Módulo — health_api_client', () => {
  it('debe exportar fetchHealth como función async', () => {
    expect(typeof fetchHealth).toBe('function');
  });

  it('debe exportar fetchHealthWithRetry como función async', () => {
    expect(typeof fetchHealthWithRetry).toBe('function');
  });

  it('debe exportar buildExponentialDelay como función pura', () => {
    expect(typeof buildExponentialDelay).toBe('function');
  });

  it('debe exportar shouldRetry como función pura', () => {
    expect(typeof shouldRetry).toBe('function');
  });

  it('debe exportar FetchHealthError como clase (constructor)', () => {
    expect(typeof FetchHealthError).toBe('function');
    expect(new FetchHealthError(503, 'SYSTEM_DEGRADED', 'msg')).toBeInstanceOf(Error);
  });
});

// =============================================================================
// BLOQUE 2 — fetchHealth: contrato de request al endpoint real
// spec §Sección Backend: GET /api/v1/health, header Accept: application/json
// =============================================================================

describe('TSK-I1-F03-R | fetchHealth — Contrato de Request HTTP', () => {
  const healthyResponse: HealthCheckResponse = {
    status: 'healthy',
    version: '1.0.0',
    timestamp: '2026-04-11T20:00:00.000Z',
  };

  it('debe llamar a fetch con la URL /api/v1/health', async () => {
    mockFetch.mockResolvedValueOnce(buildMockResponse(healthyResponse, 200));
    await fetchHealth();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/health');
  });

  it('debe incluir el header Accept: application/json (spec §Request Headers)', async () => {
    mockFetch.mockResolvedValueOnce(buildMockResponse(healthyResponse, 200));
    await fetchHealth();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['Accept'] ?? headers?.['accept']).toBe('application/json');
  });

  it('debe incluir X-Health-Key cuando se provee apiKey (spec §Acceso Privado)', async () => {
    const apiKey = 'a1b2c3d4-e5f6-4789-ab01-cdef01234567';
    mockFetch.mockResolvedValueOnce(buildMockResponse(healthyResponse, 200));
    await fetchHealth({ apiKey });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['X-Health-Key']).toBe(apiKey);
  });

  it('NO debe incluir X-Health-Key cuando no se provee apiKey (acceso público)', async () => {
    mockFetch.mockResolvedValueOnce(buildMockResponse(healthyResponse, 200));
    await fetchHealth();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['X-Health-Key']).toBeUndefined();
  });

  it('debe usar el verbo GET (spec §Definición de Endpoints)', async () => {
    mockFetch.mockResolvedValueOnce(buildMockResponse(healthyResponse, 200));
    await fetchHealth();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
  });
});

// =============================================================================
// BLOQUE 3 — fetchHealth: Respuestas exitosas (HTTP 200)
// spec §Success (200 OK): modo público y modo privado
// =============================================================================

describe('TSK-I1-F03-R | fetchHealth — Respuestas 200 OK', () => {
  it('retorna HealthCheckResponse tipada en modo público (sin performance)', async () => {
    const publicResponse: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:00:00.000Z',
    };
    mockFetch.mockResolvedValueOnce(buildMockResponse(publicResponse, 200));
    const result = await fetchHealth();
    expect(result.status).toBe('healthy');
    expect(result.version).toBe('1.0.0');
  });

  it('retorna HealthCheckResponse completa en modo privado (con performance)', async () => {
    const privateResponse: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:00:00.000Z',
      performance: { api_latency_ms: 45.00, latency_type: 'Server-side processing' },
      dependencies: {
        database: 'connected',
        redis: 'connected',
        email_service: 'config_valid',
        captcha_service: 'config_valid',
      },
    };
    mockFetch.mockResolvedValueOnce(buildMockResponse(privateResponse, 200));
    const result = await fetchHealth({ apiKey: 'a1b2c3d4-e5f6-4789-ab01-cdef01234567' });
    expect(result.status).toBe('healthy');
    expect((result as Extract<HealthCheckResponse, { status: 'healthy' }>).performance?.api_latency_ms).toBe(45.00);
  });
});

// =============================================================================
// BLOQUE 4 — fetchHealth: Errores HTTP → FetchHealthError
// spec §Errors: 400, 403, 406, 429, 503
// =============================================================================

describe('TSK-I1-F03-R | fetchHealth — Errores HTTP → FetchHealthError', () => {
  it('lanza FetchHealthError con statusCode 400 ante MALFORMED_REQUEST', async () => {
    const body: HealthCheckResponse = {
      status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
      error_code: 'MALFORMED_REQUEST', message: 'Formato de X-Health-Key inválido.',
    };
    mockFetch.mockResolvedValueOnce(buildMockResponse(body, 400));
    await expect(fetchHealth({ apiKey: 'formato-invalido' }))
      .rejects.toBeInstanceOf(FetchHealthError);
  });

  it('FetchHealthError.statusCode es 400 para MALFORMED_REQUEST', async () => {
    const body: HealthCheckResponse = {
      status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
      error_code: 'MALFORMED_REQUEST', message: 'Formato de X-Health-Key inválido.',
    };
    mockFetch.mockResolvedValueOnce(buildMockResponse(body, 400));
    const err = await fetchHealth({ apiKey: 'invalido' }).catch(e => e);
    expect(err).toBeInstanceOf(FetchHealthError);
    expect((err as FetchHealthError).statusCode).toBe(400);
  });

  it('lanza FetchHealthError con statusCode 403 ante AUTH_REQUIRED', async () => {
    const body: HealthCheckResponse = {
      status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
      error_code: 'AUTH_REQUIRED', message: 'Llave de salud incorrecta o expirada.',
    };
    mockFetch.mockResolvedValueOnce(buildMockResponse(body, 403));
    const err = await fetchHealth({ apiKey: 'a1b2c3d4-e5f6-4789-ab01-000000000000' }).catch(e => e);
    expect(err).toBeInstanceOf(FetchHealthError);
    expect((err as FetchHealthError).statusCode).toBe(403);
    expect((err as FetchHealthError).errorCode).toBe('AUTH_REQUIRED');
  });

  it('lanza FetchHealthError con statusCode 429 ante RATE_LIMIT_EXCEEDED', async () => {
    const body: HealthCheckResponse = {
      status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
      error_code: 'RATE_LIMIT_EXCEEDED', message: 'Demasiadas peticiones.',
    };
    mockFetch.mockResolvedValueOnce(
      buildMockResponse(body, 429, { 'retry-after': '30' })
    );
    const err = await fetchHealth().catch(e => e);
    expect(err).toBeInstanceOf(FetchHealthError);
    expect((err as FetchHealthError).statusCode).toBe(429);
    expect((err as FetchHealthError).errorCode).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('FetchHealthError captura retryAfterMs desde el header Retry-After (spec §429)', async () => {
    const body: HealthCheckResponse = {
      status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
      error_code: 'RATE_LIMIT_EXCEEDED', message: 'Demasiadas peticiones.',
    };
    mockFetch.mockResolvedValueOnce(
      buildMockResponse(body, 429, { 'retry-after': '30' })
    );
    const err = await fetchHealth().catch(e => e);
    // Retry-After: 30 segundos → 30000ms
    expect((err as FetchHealthError).retryAfterMs).toBe(30_000);
  });

  it('lanza FetchHealthError con statusCode 503 ante SYSTEM_DEGRADED', async () => {
    const body: HealthCheckResponse = {
      status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
      error_code: 'SYSTEM_DEGRADED', message: 'Servicios críticos no disponibles.',
      unhealthy_services: ['database', 'redis'],
    };
    mockFetch.mockResolvedValueOnce(buildMockResponse(body, 503));
    const err = await fetchHealth().catch(e => e);
    expect(err).toBeInstanceOf(FetchHealthError);
    expect((err as FetchHealthError).statusCode).toBe(503);
    expect((err as FetchHealthError).errorCode).toBe('SYSTEM_DEGRADED');
  });

  it('FetchHealthError.response contiene el body completo del error 503', async () => {
    const body: HealthCheckResponse = {
      status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
      error_code: 'SYSTEM_DEGRADED', message: 'Servicios críticos no disponibles.',
      unhealthy_services: ['redis'],
    };
    mockFetch.mockResolvedValueOnce(buildMockResponse(body, 503));
    const err = await fetchHealth().catch(e => e);
    expect((err as FetchHealthError).response).toEqual(body);
  });
});

// =============================================================================
// BLOQUE 5 — fetchHealth: Fallos de Red
// spec §Error Banner: muestra reintento ante errores de conectividad
// =============================================================================

describe('TSK-I1-F03-R | fetchHealth — Fallos de Red (Network Error)', () => {
  it('rechaza con FetchHealthError ante TypeError de red (fetch throws)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(fetchHealth()).rejects.toBeInstanceOf(FetchHealthError);
  });

  it('FetchHealthError.statusCode es 0 ante fallo de red (sin HTTP)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const err = await fetchHealth().catch(e => e);
    expect((err as FetchHealthError).statusCode).toBe(0);
  });

  it('propaga el AbortSignal al fetch subyacente (soporte de cancelación)', async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValueOnce(
      buildMockResponse({ status: 'healthy', version: '1.0.0', timestamp: new Date().toISOString() })
    );
    await fetchHealth({ signal: controller.signal });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init?.signal).toBe(controller.signal);
  });
});

// =============================================================================
// BLOQUE 6 — shouldRetry: lógica pura de decisión de reintento
// spec §Manejo de Estados UI: reintento automático en caso de 503/429
// =============================================================================

describe('TSK-I1-F03-R | shouldRetry — Decisión Pura de Reintento', () => {
  it('retorna true para statusCode 429 (RATE_LIMIT_EXCEEDED — reintentable)', () => {
    expect(shouldRetry(429)).toBe(true);
  });

  it('retorna true para statusCode 503 (SYSTEM_DEGRADED — reintentable)', () => {
    expect(shouldRetry(503)).toBe(true);
  });

  it('retorna true para statusCode 0 (fallo de red — reintentable)', () => {
    expect(shouldRetry(0)).toBe(true);
  });

  it('retorna false para statusCode 200 (éxito — no reintenta)', () => {
    expect(shouldRetry(200)).toBe(false);
  });

  it('retorna false para statusCode 400 (error de cliente — no reintenta)', () => {
    expect(shouldRetry(400)).toBe(false);
  });

  it('retorna false para statusCode 403 (auth — no reintenta con misma llave)', () => {
    expect(shouldRetry(403)).toBe(false);
  });

  it('retorna false para statusCode 406 (content negotiation — no reintenta)', () => {
    expect(shouldRetry(406)).toBe(false);
  });

  it('es una función pura: mismos inputs → mismos outputs', () => {
    expect(shouldRetry(503)).toBe(shouldRetry(503));
    expect(shouldRetry(429)).toBe(shouldRetry(429));
    expect(shouldRetry(200)).toBe(shouldRetry(200));
  });
});

// =============================================================================
// BLOQUE 7 — buildExponentialDelay: cálculo puro del backoff
// spec §TSK-I1-F03-G: reintento con backoff exponencial
// =============================================================================

describe('TSK-I1-F03-R | buildExponentialDelay — Cálculo de Backoff Exponencial', () => {
  it('retorna un número positivo para attempt 0 (primer reintento)', () => {
    const delay = buildExponentialDelay(0);
    expect(typeof delay).toBe('number');
    expect(delay).toBeGreaterThan(0);
  });

  it('intento 1 produce mayor delay que intento 0 (crecimiento exponencial)', () => {
    const delay0 = buildExponentialDelay(0, 1000);
    const delay1 = buildExponentialDelay(1, 1000);
    expect(delay1).toBeGreaterThan(delay0);
  });

  it('intento 2 produce mayor delay que intento 1', () => {
    const delay1 = buildExponentialDelay(1, 1000);
    const delay2 = buildExponentialDelay(2, 1000);
    expect(delay2).toBeGreaterThan(delay1);
  });

  it('respeta retryAfterMs cuando es mayor que el delay calculado', () => {
    // Retry-After: 30 segundos → 30000ms debe tener prioridad sobre backoff corto
    const baseDelay = buildExponentialDelay(0, 100); // backoff corto
    const withRetryAfter = buildExponentialDelay(0, 100, 30_000);
    expect(withRetryAfter).toBeGreaterThanOrEqual(30_000);
  });

  it('sin retryAfterMs usa únicamente el cálculo exponencial', () => {
    const delay = buildExponentialDelay(0, 1000, undefined);
    expect(delay).toBeLessThan(30_000); // sin Retry-After externo
  });

  it('es una función pura: mismos inputs → mismos outputs', () => {
    expect(buildExponentialDelay(1, 500)).toBe(buildExponentialDelay(1, 500));
    expect(buildExponentialDelay(2, 1000, 5000)).toBe(buildExponentialDelay(2, 1000, 5000));
  });
});

// =============================================================================
// BLOQUE 8 — fetchHealthWithRetry: lógica de reintento automático
// spec §TSK-I1-F03-G DoD: "reintenta automáticamente en caso de 503/429"
// =============================================================================

describe('TSK-I1-F03-R | fetchHealthWithRetry — Reintento Automático', () => {
  const defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 10, // delay mínimo para tests rápidos
  };

  const successResponse: HealthCheckResponse = {
    status: 'healthy', version: '1.0.0', timestamp: new Date().toISOString(),
  };

  const systemDegradedBody: HealthCheckResponse = {
    status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
    error_code: 'SYSTEM_DEGRADED', message: 'Servicios críticos no disponibles.',
    unhealthy_services: ['database'],
  };

  const rateLimitBody: HealthCheckResponse = {
    status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
    error_code: 'RATE_LIMIT_EXCEEDED', message: 'Límite excedido.',
  };

  it('retorna FetchHealthResult con data y retryCount en éxito al primer intento', async () => {
    mockFetch.mockResolvedValueOnce(buildMockResponse(successResponse, 200));
    const result = await fetchHealthWithRetry({}, defaultRetryConfig);
    expect(result.data.status).toBe('healthy');
    expect(result.retryCount).toBe(0);
  });

  it('retorna FetchHealthResult con tipo correcto', async () => {
    mockFetch.mockResolvedValueOnce(buildMockResponse(successResponse, 200));
    const result: FetchHealthResult = await fetchHealthWithRetry({}, defaultRetryConfig);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('retryCount');
  });

  it('reintenta ante 503 y retorna éxito si la 2ª petición tiene 200 OK', async () => {
    jest.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(buildMockResponse(systemDegradedBody, 503))
      .mockResolvedValueOnce(buildMockResponse(successResponse, 200));

    const resultPromise = fetchHealthWithRetry({}, defaultRetryConfig);
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.retryCount).toBe(1);
    expect(result.data.status).toBe('healthy');
    jest.useRealTimers();
  });

  it('reintenta ante 429 y retorna éxito si la 2ª petición tiene 200 OK', async () => {
    jest.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(buildMockResponse(rateLimitBody, 429, { 'retry-after': '1' }))
      .mockResolvedValueOnce(buildMockResponse(successResponse, 200));

    const resultPromise = fetchHealthWithRetry({}, defaultRetryConfig);
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.retryCount).toBe(1);
    jest.useRealTimers();
  });

  it('registra el número correcto de reintentos en FetchHealthResult.retryCount', async () => {
    jest.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(buildMockResponse(systemDegradedBody, 503))
      .mockResolvedValueOnce(buildMockResponse(systemDegradedBody, 503))
      .mockResolvedValueOnce(buildMockResponse(successResponse, 200));

    const resultPromise = fetchHealthWithRetry({}, defaultRetryConfig);
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.retryCount).toBe(2);
    jest.useRealTimers();
  });

  it('lanza FetchHealthError tras agotar maxRetries con 503 persistente', async () => {
    jest.useFakeTimers();
    const config: RetryConfig = { maxRetries: 2, baseDelayMs: 10 };
    mockFetch.mockResolvedValue(buildMockResponse(systemDegradedBody, 503));

    // Capturar la promesa antes de correr los timers para evitar unhandled rejection
    // (en Jest 30 una promesa que rechaza sin catch activo falla el test)
    const settledPromise = fetchHealthWithRetry({}, config)
      .then(v => ({ ok: true as const, value: v }))
      .catch(e => ({ ok: false as const, error: e as unknown }));

    await jest.runAllTimersAsync();
    const settled = await settledPromise;

    // 1 intento original + 2 reintentos = 3 llamadas total
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(settled.ok).toBe(false);
    expect(settled.ok === false && settled.error).toBeInstanceOf(FetchHealthError);
    jest.useRealTimers();
  });

  it('NO reintenta ante error 400 (error de cliente — no reintentable)', async () => {
    const body: HealthCheckResponse = {
      status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
      error_code: 'MALFORMED_REQUEST', message: 'Formato inválido.',
    };
    mockFetch.mockResolvedValueOnce(buildMockResponse(body, 400));
    await expect(fetchHealthWithRetry({}, defaultRetryConfig)).rejects.toBeInstanceOf(FetchHealthError);
    // Solo 1 llamada — no reintenta
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('NO reintenta ante error 403 (llave incorrecta — no reintentable)', async () => {
    const body: HealthCheckResponse = {
      status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
      error_code: 'AUTH_REQUIRED', message: 'Llave incorrecta.',
    };
    mockFetch.mockResolvedValueOnce(buildMockResponse(body, 403));
    await expect(fetchHealthWithRetry({}, defaultRetryConfig)).rejects.toBeInstanceOf(FetchHealthError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('respeta retryAfterMs del header Retry-After al calcular el delay del 429', async () => {
    jest.useFakeTimers();
    const advanceSpy = jest.spyOn(global, 'setTimeout');

    mockFetch
      .mockResolvedValueOnce(buildMockResponse(rateLimitBody, 429, { 'retry-after': '30' }))
      .mockResolvedValueOnce(buildMockResponse(successResponse, 200));

    const resultPromise = fetchHealthWithRetry({}, defaultRetryConfig);
    await jest.runAllTimersAsync();
    await resultPromise;

    // Al menos uno de los timeouts debe ser >= 30000ms (Retry-After header)
    const delays = advanceSpy.mock.calls.map(([, ms]) => ms as number);
    expect(delays.some(d => d >= 30_000)).toBe(true);

    advanceSpy.mockRestore();
    jest.useRealTimers();
  });
});

// =============================================================================
// BLOQUE 9 — FetchHealthError: clase de error estructurada
// Necesaria para que useHealth mapee errores a acciones UI (TSK-I1-F03-RF)
// =============================================================================

describe('TSK-I1-F03-R | FetchHealthError — Estructura de Error Contractual', () => {
  it('extiende la clase Error nativa', () => {
    const err = new FetchHealthError(503, 'SYSTEM_DEGRADED', 'msg');
    expect(err).toBeInstanceOf(Error);
  });

  it('expone statusCode como propiedad de instancia', () => {
    const err = new FetchHealthError(503, 'SYSTEM_DEGRADED', 'msg');
    expect(err.statusCode).toBe(503);
  });

  it('expone errorCode como propiedad de instancia', () => {
    const err = new FetchHealthError(429, 'RATE_LIMIT_EXCEEDED', 'msg');
    expect(err.errorCode).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('expone message como propiedad de instancia (heredada de Error)', () => {
    const err = new FetchHealthError(503, 'SYSTEM_DEGRADED', 'Servicios caídos');
    expect(err.message).toBe('Servicios caídos');
  });

  it('expone retryAfterMs como propiedad opcional (undefined por defecto)', () => {
    const err = new FetchHealthError(503, 'SYSTEM_DEGRADED', 'msg');
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('acepta retryAfterMs como parámetro opcional en el constructor', () => {
    const err = new FetchHealthError(429, 'RATE_LIMIT_EXCEEDED', 'msg', undefined, 30_000);
    expect(err.retryAfterMs).toBe(30_000);
  });

  it('expone response (HealthCheckResponse) como propiedad opcional', () => {
    const response: HealthCheckResponse = {
      status: 'unhealthy', version: '1.0.0', timestamp: new Date().toISOString(),
      error_code: 'SYSTEM_DEGRADED', message: 'msg',
    };
    const err = new FetchHealthError(503, 'SYSTEM_DEGRADED', 'msg', response);
    expect(err.response).toEqual(response);
  });

  it('FetchHealthError.name es "FetchHealthError" (identificable en logs)', () => {
    const err = new FetchHealthError(503, 'SYSTEM_DEGRADED', 'msg');
    expect(err.name).toBe('FetchHealthError');
  });
});

// =============================================================================
// BLOQUE 10 — Contrato de Integración con useHealth
// spec §TSK-I1-F03-G: "el dashboard consume /api/v1/health real"
// El hook useHealth debe poder recibir un service inyectable para tests
// =============================================================================

describe('TSK-I1-F03-R | Contrato de Integración — fetchHealth como servicio inyectable', () => {
  it('fetchHealth es invocable sin argumentos (modo público por defecto)', async () => {
    const body: HealthCheckResponse = {
      status: 'healthy', version: '1.0.0', timestamp: new Date().toISOString(),
    };
    mockFetch.mockResolvedValueOnce(buildMockResponse(body, 200));
    const result = await fetchHealth();
    expect(result).toBeDefined();
  });

  it('fetchHealth con options vacío {} equivale a invocación sin args (modo público)', async () => {
    const body: HealthCheckResponse = {
      status: 'healthy', version: '1.0.0', timestamp: new Date().toISOString(),
    };
    mockFetch.mockResolvedValueOnce(buildMockResponse(body, 200));
    const result = await fetchHealth({});
    expect(result.status).toBe('healthy');
  });

  it('FetchHealthOptions.apiKey es opcional (permite acceso público y privado)', () => {
    // Validación de tipo en tiempo de compilación: el tipo FetchHealthOptions
    // debe hacer apiKey opcional para soportar ambos modos de acceso
    const publicOptions: FetchHealthOptions = {};
    const privateOptions: FetchHealthOptions = { apiKey: 'uuid-aqui' };
    expect(publicOptions).toBeDefined();
    expect(privateOptions).toBeDefined();
  });

  it('RetryConfig.maxRetries define el límite máximo de reintentos', () => {
    const config: RetryConfig = { maxRetries: 3, baseDelayMs: 1000 };
    expect(config.maxRetries).toBe(3);
  });

  it('RetryConfig.baseDelayMs define el delay base del backoff exponencial', () => {
    const config: RetryConfig = { maxRetries: 3, baseDelayMs: 1000 };
    expect(config.baseDelayMs).toBe(1000);
  });
});
