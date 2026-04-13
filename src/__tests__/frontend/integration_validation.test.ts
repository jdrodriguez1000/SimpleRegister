/**
 * integration_validation.test.ts — TSK-I1-F03-V: Integration Validation
 *
 * Propósito: Validar el flujo de recuperación E2E del dashboard de salud.
 * Cubre el ciclo completo: API caída → estado error → reintento → restauración.
 *
 * ESTADO ESPERADO: GREEN (todos los tests deben pasar)
 *
 * Estrategia de validación (entorno Node — sin DOM):
 *   1. Pipeline de Servicio:     fetchHealthWithRetry → recuperación completa
 *   2. Máquina de Estados E2E:   error → loading → success (ciclo de recuperación)
 *   3. Mapa HTTP → Acción UI:    cada código HTTP produce el estado UI correcto
 *   4. Contratos de Cabecera:    Retry-After respetado en la recuperación
 *   5. Contrato de Cableado:     inspección de código fuente de useHealth + componentes
 *
 * DoD: Simulación de error manual muestra banner de reintento y
 *      éxito tras restauración de API.
 *
 * Trazabilidad: TSK-I1-F03-V
 * Dependencias resueltas: TSK-I1-F03-G (service layer), TSK-I1-F03-RF (refactor)
 * Siguiente tarea: TSK-I1-F03-C (frontend-reviewer certificación final)
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  fetchHealth,
  fetchHealthWithRetry,
  buildExponentialDelay,
  shouldRetry,
  FetchHealthError,
} from '@/src/lib/services/health_api_client';

import type { RetryConfig } from '@/src/lib/services/health_api_client';

import {
  getInitialState,
  applyHealthResponse,
  computeSLALevel,
} from '@/src/hooks/useHealth';

import type { HealthState } from '@/src/hooks/useHealth';

import type { HealthCheckResponse, HealthUIState, SLALevel } from '@/types/health';

// =============================================================================
// Setup Global — Mock de fetch nativo + lectura de fuentes
// =============================================================================

const ROOT = process.cwd();
const readSource = (p: string) => fs.readFileSync(path.resolve(ROOT, p), 'utf-8');

const useHealthSrc      = readSource('src/hooks/useHealth.ts');
const healthDashSrc     = readSource('src/app/components/HealthDashboard.tsx');
const errorBannerSrc    = readSource('src/app/components/ErrorBanner.tsx');

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

/** Factory de Response mockeada */
function mockResponse(
  body: HealthCheckResponse,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as Response;
}

// Fixtures de respuesta
const HEALTHY_200: HealthCheckResponse = {
  status: 'healthy', version: '1.0.0', timestamp: '2026-04-13T00:00:00.000Z',
  performance: { api_latency_ms: 45.00, latency_type: 'Server-side processing' },
  dependencies: { database: 'connected', redis: 'connected', email_service: 'config_valid', captcha_service: 'config_valid' },
};

const PUBLIC_200: HealthCheckResponse = {
  status: 'healthy', version: '1.0.0', timestamp: '2026-04-13T00:00:00.000Z',
};

const SYSTEM_DEGRADED_503: HealthCheckResponse = {
  status: 'unhealthy', version: '1.0.0', timestamp: '2026-04-13T00:00:00.000Z',
  error_code: 'SYSTEM_DEGRADED', message: 'Servicios críticos no disponibles.',
  unhealthy_services: ['database', 'redis'],
};

const RATE_LIMIT_429: HealthCheckResponse = {
  status: 'unhealthy', version: '1.0.0', timestamp: '2026-04-13T00:00:00.000Z',
  error_code: 'RATE_LIMIT_EXCEEDED', message: 'Demasiadas peticiones. Límite de 10 req/min excedido.',
};

const MALFORMED_400: HealthCheckResponse = {
  status: 'unhealthy', version: '1.0.0', timestamp: '2026-04-13T00:00:00.000Z',
  error_code: 'MALFORMED_REQUEST', message: 'Formato de X-Health-Key inválido.',
};

const AUTH_403: HealthCheckResponse = {
  status: 'unhealthy', version: '1.0.0', timestamp: '2026-04-13T00:00:00.000Z',
  error_code: 'AUTH_REQUIRED', message: 'Llave de salud incorrecta o expirada.',
};

// =============================================================================
// BLOQUE 1 — Flujo de Recuperación del Servicio (503 → retry → 200)
// DoD: "éxito tras restauración de API"
// =============================================================================

describe('TSK-I1-F03-V | Pipeline de Recuperación: 503 → retry → 200', () => {
  const retryConfig: RetryConfig = { maxRetries: 3, baseDelayMs: 10 };

  it('recupera exitosamente tras un 503 transitorio (1 reintento)', async () => {
    jest.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(mockResponse(SYSTEM_DEGRADED_503, 503))
      .mockResolvedValueOnce(mockResponse(HEALTHY_200, 200));

    const settled = fetchHealthWithRetry({}, retryConfig)
      .then(v => ({ ok: true as const, value: v }))
      .catch(e => ({ ok: false as const, error: e as unknown }));

    await jest.runAllTimersAsync();
    const result = await settled;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.status).toBe('healthy');
      expect(result.value.retryCount).toBe(1);
    }
    jest.useRealTimers();
  });

  it('recupera exitosamente tras dos 503 consecutivos (2 reintentos)', async () => {
    jest.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(mockResponse(SYSTEM_DEGRADED_503, 503))
      .mockResolvedValueOnce(mockResponse(SYSTEM_DEGRADED_503, 503))
      .mockResolvedValueOnce(mockResponse(HEALTHY_200, 200));

    const settled = fetchHealthWithRetry({}, retryConfig)
      .then(v => ({ ok: true as const, value: v }))
      .catch(e => ({ ok: false as const, error: e as unknown }));

    await jest.runAllTimersAsync();
    const result = await settled;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.retryCount).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }
    jest.useRealTimers();
  });

  it('recupera exitosamente tras tres 503 consecutivos (3 reintentos — límite)', async () => {
    jest.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(mockResponse(SYSTEM_DEGRADED_503, 503))
      .mockResolvedValueOnce(mockResponse(SYSTEM_DEGRADED_503, 503))
      .mockResolvedValueOnce(mockResponse(SYSTEM_DEGRADED_503, 503))
      .mockResolvedValueOnce(mockResponse(HEALTHY_200, 200));

    const settled = fetchHealthWithRetry({}, retryConfig)
      .then(v => ({ ok: true as const, value: v }))
      .catch(e => ({ ok: false as const, error: e as unknown }));

    await jest.runAllTimersAsync();
    const result = await settled;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.retryCount).toBe(3);
    }
    jest.useRealTimers();
  });

  it('falla definitivamente si el 503 persiste más allá de maxRetries', async () => {
    jest.useFakeTimers();
    const config: RetryConfig = { maxRetries: 2, baseDelayMs: 10 };
    mockFetch.mockResolvedValue(mockResponse(SYSTEM_DEGRADED_503, 503));

    const settled = fetchHealthWithRetry({}, config)
      .then(v => ({ ok: true as const, value: v }))
      .catch(e => ({ ok: false as const, error: e as unknown }));

    await jest.runAllTimersAsync();
    const result = await settled;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(FetchHealthError);
      expect((result.error as FetchHealthError).statusCode).toBe(503);
    }
    jest.useRealTimers();
  });

  it('el delay entre reintentos crece exponencialmente (backoff verificado)', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const config: RetryConfig = { maxRetries: 3, baseDelayMs: 100 };

    mockFetch
      .mockResolvedValueOnce(mockResponse(SYSTEM_DEGRADED_503, 503))
      .mockResolvedValueOnce(mockResponse(SYSTEM_DEGRADED_503, 503))
      .mockResolvedValueOnce(mockResponse(SYSTEM_DEGRADED_503, 503))
      .mockResolvedValueOnce(mockResponse(HEALTHY_200, 200));

    const settled = fetchHealthWithRetry({}, config)
      .then(v => ({ ok: true as const, value: v }))
      .catch(e => ({ ok: false as const, error: e as unknown }));

    await jest.runAllTimersAsync();
    await settled;

    const delays = setTimeoutSpy.mock.calls.map(([, ms]) => ms as number);
    // Debe haber 3 delays con crecimiento exponencial: 100, 200, 400
    expect(delays.length).toBeGreaterThanOrEqual(3);
    expect(delays[0]).toBe(100);  // 100 * 2^0
    expect(delays[1]).toBe(200);  // 100 * 2^1
    expect(delays[2]).toBe(400);  // 100 * 2^2

    setTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });
});

// =============================================================================
// BLOQUE 2 — Flujo de Recuperación del Servicio (429 → esperar → 200)
// spec §429: respetar Retry-After antes de reintentar
// =============================================================================

describe('TSK-I1-F03-V | Pipeline de Recuperación: 429 → esperar Retry-After → 200', () => {
  it('recupera exitosamente tras un 429 con Retry-After', async () => {
    jest.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(mockResponse(RATE_LIMIT_429, 429, { 'retry-after': '1' }))
      .mockResolvedValueOnce(mockResponse(HEALTHY_200, 200));

    const settled = fetchHealthWithRetry({}, { maxRetries: 2, baseDelayMs: 10 })
      .then(v => ({ ok: true as const, value: v }))
      .catch(e => ({ ok: false as const, error: e as unknown }));

    await jest.runAllTimersAsync();
    const result = await settled;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.retryCount).toBe(1);
      expect(result.value.data.status).toBe('healthy');
    }
    jest.useRealTimers();
  });

  it('el delay de 429 respeta el header Retry-After (prioridad sobre backoff)', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    mockFetch
      .mockResolvedValueOnce(mockResponse(RATE_LIMIT_429, 429, { 'retry-after': '30' }))
      .mockResolvedValueOnce(mockResponse(HEALTHY_200, 200));

    const settled = fetchHealthWithRetry({}, { maxRetries: 2, baseDelayMs: 10 })
      .then(v => ({ ok: true as const, value: v }))
      .catch(e => ({ ok: false as const, error: e as unknown }));

    await jest.runAllTimersAsync();
    await settled;

    const delays = setTimeoutSpy.mock.calls.map(([, ms]) => ms as number);
    // El delay debe ser ≥ 30000ms (30 segundos de Retry-After)
    expect(delays.some(d => d >= 30_000)).toBe(true);

    setTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });
});

// =============================================================================
// BLOQUE 3 — Flujo de Recuperación de Red (TypeError → retry → 200)
// spec §Manejo de Estados UI — Error: reintento ante fallos de conectividad
// =============================================================================

describe('TSK-I1-F03-V | Pipeline de Recuperación: Error de Red → retry → 200', () => {
  it('recupera exitosamente tras un fallo de red transitorio', async () => {
    jest.useFakeTimers();
    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(mockResponse(HEALTHY_200, 200));

    const settled = fetchHealthWithRetry({}, { maxRetries: 2, baseDelayMs: 10 })
      .then(v => ({ ok: true as const, value: v }))
      .catch(e => ({ ok: false as const, error: e as unknown }));

    await jest.runAllTimersAsync();
    const result = await settled;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.retryCount).toBe(1);
    }
    jest.useRealTimers();
  });

  it('error de red persistente → FetchHealthError tras agotar reintentos', async () => {
    jest.useFakeTimers();
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const settled = fetchHealthWithRetry({}, { maxRetries: 2, baseDelayMs: 10 })
      .then(v => ({ ok: true as const, value: v }))
      .catch(e => ({ ok: false as const, error: e as unknown }));

    await jest.runAllTimersAsync();
    const result = await settled;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(FetchHealthError);
      expect((result.error as FetchHealthError).statusCode).toBe(0);
    }
    jest.useRealTimers();
  });
});

// =============================================================================
// BLOQUE 4 — Máquina de Estados E2E: Error → Recovery → Success
// DoD: "Simulación de error manual muestra banner de reintento y
//       éxito tras restauración de API"
// =============================================================================

describe('TSK-I1-F03-V | Máquina de Estados E2E — Ciclo Completo de Recuperación', () => {
  const loadingState = (): HealthState => ({
    uiState: 'loading', data: null, slaLevel: null, error: null, lastFetchedAt: null,
  });

  it('503 → estado error: uiState="error", error="SYSTEM_DEGRADED" (banner visible)', () => {
    const errorState = applyHealthResponse(loadingState(), SYSTEM_DEGRADED_503);

    // Estado que activa el ErrorBanner con botón de reintento
    expect(errorState.uiState).toBe<HealthUIState>('error');
    expect(errorState.error).toBe('SYSTEM_DEGRADED');
    expect(errorState.slaLevel).toBe<SLALevel>('critical');
    expect(errorState.data).toEqual(SYSTEM_DEGRADED_503);
    expect(errorState.lastFetchedAt).toBeInstanceOf(Date);
  });

  it('429 → estado error: uiState="error", error="RATE_LIMIT_EXCEEDED"', () => {
    const errorState = applyHealthResponse(loadingState(), RATE_LIMIT_429);

    expect(errorState.uiState).toBe<HealthUIState>('error');
    expect(errorState.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(errorState.slaLevel).toBe<SLALevel>('critical');
  });

  it('200 tras error → recuperación exitosa: uiState="success" (ErrorBanner desaparece)', () => {
    // 1. Estado de error previo (API estaba caída)
    const errorState = applyHealthResponse(loadingState(), SYSTEM_DEGRADED_503);
    expect(errorState.uiState).toBe<HealthUIState>('error');

    // 2. Usuario hace clic en "Reintentar" → uiState: 'loading' (simulado)
    const retryingState: HealthState = { ...errorState, uiState: 'loading' };

    // 3. API restaurada → respuesta 200
    const recoveredState = applyHealthResponse(retryingState, HEALTHY_200);

    // 4. Recuperación confirmada: dashboard visible, sin error
    expect(recoveredState.uiState).toBe<HealthUIState>('success');
    expect(recoveredState.error).toBeNull();
    expect(recoveredState.data?.status).toBe('healthy');
    expect(recoveredState.slaLevel).toBe<SLALevel>('green');
    expect(recoveredState.lastFetchedAt).toBeInstanceOf(Date);
  });

  it('el estado de error previo NO contamina el estado de recuperación', () => {
    const errorState = applyHealthResponse(loadingState(), SYSTEM_DEGRADED_503);
    const retryingState: HealthState = { ...errorState, uiState: 'loading' };
    const recoveredState = applyHealthResponse(retryingState, HEALTHY_200);

    // Los campos de error deben estar limpiados tras la recuperación
    expect(recoveredState.uiState).not.toBe('error');
    expect(recoveredState.error).toBeNull();
  });

  it('secuencia completa de estados: idle → loading → error → loading → success', () => {
    // idle (estado inicial)
    const s0 = getInitialState();
    expect(s0.uiState).toBe('idle');

    // → loading (primer fetch iniciado)
    const s1: HealthState = { ...s0, uiState: 'loading' };
    expect(s1.uiState).toBe('loading');

    // → error (API caída, 503)
    const s2 = applyHealthResponse(s1, SYSTEM_DEGRADED_503);
    expect(s2.uiState).toBe('error');
    expect(s2.error).toBe('SYSTEM_DEGRADED');

    // → loading (usuario hace clic en Reintentar)
    const s3: HealthState = { ...s2, uiState: 'loading' };
    expect(s3.uiState).toBe('loading');

    // → success (API restaurada, 200)
    const s4 = applyHealthResponse(s3, HEALTHY_200);
    expect(s4.uiState).toBe('success');
    expect(s4.error).toBeNull();
    expect(s4.data?.status).toBe('healthy');
  });

  it('modo público: recuperación sin datos de performance sigue siendo success', () => {
    const errorState = applyHealthResponse(loadingState(), RATE_LIMIT_429);
    const recoveredState = applyHealthResponse(
      { ...errorState, uiState: 'loading' },
      PUBLIC_200,
    );

    expect(recoveredState.uiState).toBe<HealthUIState>('success');
    expect(recoveredState.slaLevel).toBeNull(); // sin performance en modo público
    expect(recoveredState.error).toBeNull();
  });
});

// =============================================================================
// BLOQUE 5 — Mapa HTTP → Acción UI Global
// spec §TSK-I1-F03-RF DoD: "manejo de códigos HTTP mapeado a acciones UI globales"
// =============================================================================

describe('TSK-I1-F03-V | Mapa HTTP → Acción UI — Cobertura Completa', () => {
  const loadingState = (): HealthState => ({
    uiState: 'loading', data: null, slaLevel: null, error: null, lastFetchedAt: null,
  });

  const scenarios: Array<{
    code: number;
    body: HealthCheckResponse;
    expectedUIState: HealthUIState;
    expectedError: string | null;
    expectedSLA: SLALevel | null;
    retries: boolean;
    description: string;
  }> = [
    {
      code: 200, body: HEALTHY_200,
      expectedUIState: 'success', expectedError: null, expectedSLA: 'green',
      retries: false, description: '200 OK → success + SLA green',
    },
    {
      code: 200, body: PUBLIC_200,
      expectedUIState: 'success', expectedError: null, expectedSLA: null,
      retries: false, description: '200 OK público → success + SLA null (sin performance)',
    },
    {
      code: 503, body: SYSTEM_DEGRADED_503,
      expectedUIState: 'error', expectedError: 'SYSTEM_DEGRADED', expectedSLA: 'critical',
      retries: true, description: '503 SYSTEM_DEGRADED → error crítico + reintento',
    },
    {
      code: 429, body: RATE_LIMIT_429,
      expectedUIState: 'error', expectedError: 'RATE_LIMIT_EXCEEDED', expectedSLA: 'critical',
      retries: true, description: '429 RATE_LIMIT_EXCEEDED → error crítico + reintento',
    },
    {
      code: 400, body: MALFORMED_400,
      expectedUIState: 'error', expectedError: 'MALFORMED_REQUEST', expectedSLA: 'critical',
      retries: false, description: '400 MALFORMED_REQUEST → error + sin reintento automático',
    },
    {
      code: 403, body: AUTH_403,
      expectedUIState: 'error', expectedError: 'AUTH_REQUIRED', expectedSLA: 'critical',
      retries: false, description: '403 AUTH_REQUIRED → error + sin reintento automático',
    },
  ];

  for (const { body, expectedUIState, expectedError, expectedSLA, retries, description, code } of scenarios) {
    it(`HTTP ${code}: ${description}`, () => {
      if (body.status === 'healthy') {
        const state = applyHealthResponse(loadingState(), body);
        expect(state.uiState).toBe(expectedUIState);
        expect(state.error).toBe(expectedError);
        expect(state.slaLevel).toBe(expectedSLA);
      } else {
        // Verifica mapa de error
        const state = applyHealthResponse(loadingState(), body);
        expect(state.uiState).toBe(expectedUIState);
        expect(state.error).toBe(expectedError);
        expect(state.slaLevel).toBe(expectedSLA);
      }

      // Verifica política de reintento
      expect(shouldRetry(code)).toBe(retries);
    });
  }
});

// =============================================================================
// BLOQUE 6 — Contratos de Cabecera: Retry-After en el Pipeline
// spec §429: Retry-After se convierte en retryAfterMs en FetchHealthError
// =============================================================================

describe('TSK-I1-F03-V | Contrato de Cabecera Retry-After — Pipeline Completo', () => {
  it('Retry-After: 10 → retryAfterMs = 10000ms en FetchHealthError', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(RATE_LIMIT_429, 429, { 'retry-after': '10' })
    );
    const err = (await fetchHealth().catch((e: unknown) => e)) as FetchHealthError;
    expect(err.retryAfterMs).toBe(10_000);
  });

  it('Retry-After: 60 → retryAfterMs = 60000ms en FetchHealthError', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(RATE_LIMIT_429, 429, { 'retry-after': '60' })
    );
    const err = (await fetchHealth().catch((e: unknown) => e)) as FetchHealthError;
    expect(err.retryAfterMs).toBe(60_000);
  });

  it('buildExponentialDelay prioriza retryAfterMs sobre backoff calculado', () => {
    const backoffDelay = buildExponentialDelay(0, 1_000); // 1000ms
    const withRetryAfter = buildExponentialDelay(0, 1_000, 60_000); // 60000ms
    expect(withRetryAfter).toBeGreaterThanOrEqual(60_000);
    expect(backoffDelay).toBeLessThan(60_000);
  });

  it('sin Retry-After header: retryAfterMs es undefined en FetchHealthError', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(SYSTEM_DEGRADED_503, 503));
    const err = (await fetchHealth().catch((e: unknown) => e)) as FetchHealthError;
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('sin Retry-After: buildExponentialDelay usa solo el backoff base', () => {
    const delay = buildExponentialDelay(0, 1_000, undefined);
    expect(delay).toBe(1_000); // 1000 * 2^0 = 1000
  });
});

// =============================================================================
// BLOQUE 7 — Cableado del Hook: useHealth usa el service layer real
// spec §TSK-I1-F03-RF DoD: "Lógica de reintento centralizada"
// =============================================================================

describe('TSK-I1-F03-V | Cableado de useHealth — Integración con Service Layer', () => {
  it('useHealth importa fetchHealthWithRetry del service layer (no mock interno)', () => {
    expect(useHealthSrc).toContain('fetchHealthWithRetry');
    expect(useHealthSrc).toContain('health_api_client');
  });

  it('useHealth maneja FetchHealthError (importado del service layer)', () => {
    expect(useHealthSrc).toContain('FetchHealthError');
  });

  it('useHealth usa AbortController para cancelación limpia (spec §cleanup)', () => {
    expect(useHealthSrc).toContain('AbortController');
    expect(useHealthSrc).toContain('controller.abort');
  });

  it('useHealth maneja AbortError para evitar actualizaciones en componentes desmontados', () => {
    expect(useHealthSrc).toContain('AbortError');
  });

  it('useHealth mapea FetchHealthError con response a applyHealthResponse', () => {
    expect(useHealthSrc).toContain('applyHealthResponse');
    expect(useHealthSrc).toContain('err.response');
  });

  it('useHealth no contiene buildMockResponse (mock eliminado — TSK-I1-F03-RF)', () => {
    expect(useHealthSrc).not.toContain('buildMockResponse');
  });

  it('useHealth no contiene setTimeout para simular latencia (mock eliminado)', () => {
    // El único setTimeout ahora es el del sleep en el service layer, no en el hook
    expect(useHealthSrc).not.toContain('Simula latencia');
    expect(useHealthSrc).not.toContain('setTimeout');
  });

  it('useHealth expone refetch como función que puede re-disparar el fetch', () => {
    expect(useHealthSrc).toContain('refetch: executeFetch');
  });

  it('useHealth configura la política de reintentos (maxRetries, baseDelayMs)', () => {
    expect(useHealthSrc).toContain('maxRetries');
    expect(useHealthSrc).toContain('baseDelayMs');
  });
});

// =============================================================================
// BLOQUE 8 — Cableado del Dashboard: ErrorBanner activado en uiState="error"
// DoD: "Simulación de error manual muestra banner de reintento"
// =============================================================================

describe('TSK-I1-F03-V | Cableado del Dashboard — ErrorBanner y Retry Flow', () => {
  it('HealthDashboard renderiza ErrorBanner cuando uiState es "error"', () => {
    expect(healthDashSrc).toContain('ErrorBanner');
    expect(healthDashSrc).toMatch(/uiState === 'error'[\s\S]*?ErrorBanner/s);
  });

  it('ErrorBanner recibe onRetry={refetch} (botón conectado al hook)', () => {
    expect(healthDashSrc).toContain('onRetry={refetch}');
  });

  it('ErrorBanner recibe errorCode (código de error de la Spec)', () => {
    expect(healthDashSrc).toMatch(/errorCode=\{errorCode\}/);
  });

  it('ErrorBanner recibe el mensaje del body de error cuando está disponible', () => {
    expect(healthDashSrc).toMatch(/message=\{errorMessage\}/);
  });

  it('ErrorBanner tiene role="alert" — anuncia inmediatamente al AT (WCAG)', () => {
    expect(errorBannerSrc).toContain('role="alert"');
  });

  it('ErrorBanner tiene aria-live="assertive" — urgencia máxima de anuncio', () => {
    expect(errorBannerSrc).toContain('aria-live="assertive"');
  });

  it('ErrorBanner expone el botón de reintento con aria-label descriptivo', () => {
    expect(errorBannerSrc).toContain('aria-label="Reintentar conexión con la API de salud"');
  });

  it('el botón de reintento llama a onRetry al hacer clic (onClick={onRetry})', () => {
    expect(errorBannerSrc).toContain('onClick={onRetry}');
  });

  it('el errorCode se renderiza en el banner (visible para el usuario)', () => {
    expect(errorBannerSrc).toContain('{errorCode}');
  });

  it('el mensaje de error es opcional — banner funciona sin él (doble fallback)', () => {
    // HealthDashboard tiene fallback: data?.message ?? 'Error de conexión con la API.'
    expect(healthDashSrc).toContain('Error de conexión con la API.');
  });

  it('HealthDashboard no muestra ErrorBanner en estado success', () => {
    // La rama error está separada de la rama success
    expect(healthDashSrc).toMatch(/uiState === 'error'[\s\S]*?return[\s\S]*?ErrorBanner[\s\S]*?uiState === 'success'/s);
  });
});

// =============================================================================
// BLOQUE 9 — SLA Post-Recuperación: latencia clasificada correctamente
// spec §Criterios de Degradación: la recuperación debe mostrar SLA correcto
// =============================================================================

describe('TSK-I1-F03-V | SLA Post-Recuperación — Clasificación Correcta', () => {
  const recoveredStates: Array<{
    latency: number;
    expectedSLA: SLALevel;
    description: string;
  }> = [
    { latency: 45,    expectedSLA: 'green',    description: 'latencia nominal 45ms → SLA green' },
    { latency: 199.9, expectedSLA: 'green',    description: 'latencia 199.9ms → SLA green (límite)' },
    { latency: 200,   expectedSLA: 'warning',  description: 'latencia 200ms → SLA warning (umbral)' },
    { latency: 499,   expectedSLA: 'warning',  description: 'latencia 499ms → SLA warning' },
    { latency: 500,   expectedSLA: 'critical', description: 'latencia 500ms → SLA critical (umbral)' },
    { latency: 800,   expectedSLA: 'critical', description: 'latencia 800ms → SLA critical (degradado)' },
  ];

  for (const { latency, expectedSLA, description } of recoveredStates) {
    it(`Recuperación con ${description}`, () => {
      const errorState: HealthState = {
        uiState: 'error', data: SYSTEM_DEGRADED_503, slaLevel: 'critical',
        error: 'SYSTEM_DEGRADED', lastFetchedAt: new Date(),
      };

      const recoveredResponse: HealthCheckResponse = {
        status: 'healthy', version: '1.0.0', timestamp: new Date().toISOString(),
        performance: { api_latency_ms: latency, latency_type: 'Server-side' },
        dependencies: { database: 'connected', redis: 'connected', email_service: 'config_valid', captcha_service: 'config_valid' },
      };

      const recovered = applyHealthResponse(
        { ...errorState, uiState: 'loading' },
        recoveredResponse,
      );

      expect(recovered.uiState).toBe<HealthUIState>('success');
      expect(recovered.slaLevel).toBe<SLALevel>(expectedSLA);
      // Verificar que computeSLALevel es consistente con el resultado
      expect(computeSLALevel(latency)).toBe(expectedSLA);
    });
  }
});

// =============================================================================
// BLOQUE 10 — Resumen de Integración: todos los módulos del Bloque 6 conectados
// DoD final: sistema cumple la Spec end-to-end
// =============================================================================

describe('TSK-I1-F03-V | Resumen de Integración — Bloque 6 Completo', () => {
  it('fetchHealth, shouldRetry y buildExponentialDelay son funciones del mismo módulo', () => {
    expect(typeof fetchHealth).toBe('function');
    expect(typeof shouldRetry).toBe('function');
    expect(typeof buildExponentialDelay).toBe('function');
    expect(typeof fetchHealthWithRetry).toBe('function');
    expect(typeof FetchHealthError).toBe('function');
  });

  it('el módulo health_api_client está importado en useHealth (Spec → Impl → Hook)', () => {
    expect(useHealthSrc).toContain('@/src/lib/services/health_api_client');
  });

  it('useHealth expone la misma interfaz UseHealthReturn que los bloques 4/5 (sin ruptura)', () => {
    // Los mismos exports que satisfacen los tests de TSK-I1-F02-V
    expect(typeof getInitialState).toBe('function');
    expect(typeof applyHealthResponse).toBe('function');
    expect(typeof computeSLALevel).toBe('function');
  });

  it('applyHealthResponse es inmutable — no muta el estado previo', () => {
    const errorState: HealthState = {
      uiState: 'error', data: SYSTEM_DEGRADED_503, slaLevel: 'critical',
      error: 'SYSTEM_DEGRADED', lastFetchedAt: new Date(),
    };
    const frozen = Object.freeze({ ...errorState });
    // No debe lanzar al aplicar respuesta exitosa a estado inmutable
    expect(() =>
      applyHealthResponse(frozen as HealthState, HEALTHY_200)
    ).not.toThrow();
    // El estado congelado no fue mutado
    expect(frozen.uiState).toBe('error');
  });

  it('FetchHealthError es instanceof Error (compatible con catch genérico)', () => {
    const err = new FetchHealthError(503, 'SYSTEM_DEGRADED', 'test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FetchHealthError);
  });

  it('shouldRetry cubre todos los códigos reintentables de la Spec', () => {
    // spec: 429 y 503 deben reintentarse
    expect(shouldRetry(429)).toBe(true);
    expect(shouldRetry(503)).toBe(true);
    // Fallos de red (sin HTTP) también reintentables
    expect(shouldRetry(0)).toBe(true);
    // Errores de cliente no son reintentables
    expect(shouldRetry(400)).toBe(false);
    expect(shouldRetry(403)).toBe(false);
    expect(shouldRetry(406)).toBe(false);
  });
});
