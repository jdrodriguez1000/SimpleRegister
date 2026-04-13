/**
 * TSK-I1-B02-V — health_route.test.ts
 * Agente: backend-tester
 * Cobertura objetivo: src/app/api/v1/health/route.ts → >90%
 *
 * Valida el comportamiento HTTP completo del endpoint GET /api/v1/health.
 * El servicio de salud se mockea para aislar la logica del controller.
 *
 * Codigos cubiertos: 200 (publico), 200 (privado), 400, 406, 503
 * Segun spec: 403 no aplica en Iteracion 1 — clave incorrecta retorna 200 publico.
 *
 * Actualizacion B03-G: mock de rate_limit añadido para aislar la nueva dependencia
 * introducida en TSK-I1-B03-G. Por defecto: peticion permitida (allowed: true),
 * lo que preserva el comportamiento original de todos los tests de B02.
 */

import { GET, OPTIONS } from '@/src/app/api/v1/health/route';
import type { NextRequest } from 'next/server';
import type { HealthCheckResult } from '@/src/lib/services/health_service';
import type { RateLimitResult } from '@/src/lib/middleware/rate_limit';

// =============================================================================
// Mock del servicio de salud
// =============================================================================

const mockRunHealthCheck = jest.fn<Promise<HealthCheckResult>, []>();

jest.mock('@/src/lib/services/health_service', () => ({
  runHealthCheck: () => mockRunHealthCheck(),
}));

// =============================================================================
// Mock del middleware de Rate Limit (B03-G) — aísla la lógica de rate limit
// Por defecto retorna peticion permitida para no interferir con los tests de B02.
// =============================================================================

const mockCheckRateLimit = jest.fn<Promise<RateLimitResult>, [string]>();

jest.mock('@/src/lib/middleware/rate_limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...(args as [string])),
}));

// =============================================================================
// Factory de requests mock
// =============================================================================

function mockRequest(headers: Record<string, string> = {}): NextRequest {
  const normalized: Record<string, string> = {};
  Object.keys(headers).forEach((k) => {
    normalized[k.toLowerCase()] = headers[k];
  });
  return {
    headers: {
      get: (name: string): string | null => normalized[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

// =============================================================================
// Fixtures de resultados de health check
// =============================================================================

const HEALTHY_RESULT: HealthCheckResult = {
  dependencies: {
    database: 'connected',
    redis: 'connected',
    email_service: 'config_valid',
    captcha_service: 'config_valid',
  },
  hasCriticalFailure: false,
  unhealthyServices: [],
};

const DEGRADED_RESULT: HealthCheckResult = {
  dependencies: {
    database: 'disconnected',
    redis: 'connected',
    email_service: 'config_valid',
    captcha_service: 'config_valid',
  },
  hasCriticalFailure: true,
  unhealthyServices: ['database'],
};

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  // X_HEALTH_KEY para tests de modo privado
  process.env.X_HEALTH_KEY = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
  // Rate limit: por defecto permitido (dentro del limite) para no interferir con B02
  mockCheckRateLimit.mockResolvedValue({
    allowed: true,
    limit: 10,
    remaining: 9,
    resetAt: Math.floor(Date.now() / 1000) + 55,
  });
});

afterEach(() => {
  delete process.env.X_HEALTH_KEY;
});

// =============================================================================
// BLOQUE 1: HTTP 406 — Negociacion de Contenido
// =============================================================================

describe('[B02-V] GET /api/v1/health — HTTP 406 (Accept invalido)', () => {
  it('retorna 406 si Accept es "text/html"', async () => {
    const req = mockRequest({ accept: 'text/html' });
    const res = await GET(req);
    expect(res.status).toBe(406);
  });

  it('body del 406 contiene error_code CONTENT_TYPE_NOT_SUPPORTED', async () => {
    const req = mockRequest({ accept: 'text/html' });
    const res = await GET(req);
    const body = await res.json();
    expect(body.error_code).toBe('CONTENT_TYPE_NOT_SUPPORTED');
    expect(body.status).toBe('unhealthy');
    expect(body.version).toBe('1.0.0');
  });

  it('retorna 406 si Accept es "application/xml"', async () => {
    const req = mockRequest({ accept: 'application/xml' });
    const res = await GET(req);
    expect(res.status).toBe(406);
  });

  it('acepta peticiones sin header Accept (default a application/json)', async () => {
    mockRunHealthCheck.mockResolvedValue(HEALTHY_RESULT);
    const req = mockRequest({}); // Sin Accept header
    const res = await GET(req);
    expect(res.status).not.toBe(406);
  });

  it('acepta peticiones con Accept: application/json', async () => {
    mockRunHealthCheck.mockResolvedValue(HEALTHY_RESULT);
    const req = mockRequest({ accept: 'application/json' });
    const res = await GET(req);
    expect(res.status).not.toBe(406);
  });

  it('acepta peticiones con Accept: */*', async () => {
    mockRunHealthCheck.mockResolvedValue(HEALTHY_RESULT);
    const req = mockRequest({ accept: '*/*' });
    const res = await GET(req);
    expect(res.status).not.toBe(406);
  });
});

// =============================================================================
// BLOQUE 2: HTTP 400 — X-Health-Key malformada
// =============================================================================

describe('[B02-V] GET /api/v1/health — HTTP 400 (UUID invalido)', () => {
  it('retorna 400 si X-Health-Key no es un UUID v4 valido', async () => {
    const req = mockRequest({ 'x-health-key': 'not-a-uuid' });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('body del 400 contiene error_code MALFORMED_REQUEST', async () => {
    const req = mockRequest({ 'x-health-key': 'invalid-format' });
    const res = await GET(req);
    const body = await res.json();
    expect(body.error_code).toBe('MALFORMED_REQUEST');
    expect(body.status).toBe('unhealthy');
    expect(body.version).toBe('1.0.0');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('retorna 400 si X-Health-Key es UUID con version incorrecta (v1)', async () => {
    const req = mockRequest({ 'x-health-key': '6ba7b810-9dad-11d1-80b4-00c04fd430c8' });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('retorna 400 si X-Health-Key es un string vacio', async () => {
    // Header presente pero vacio
    const req = mockRequest({ 'x-health-key': '' });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// BLOQUE 3: HTTP 200 — Modo Publico (sin key o key incorrecta con formato valido)
// =============================================================================

describe('[B02-V] GET /api/v1/health — HTTP 200 Modo Publico', () => {
  beforeEach(() => {
    mockRunHealthCheck.mockResolvedValue(HEALTHY_RESULT);
  });

  it('retorna 200 cuando no hay X-Health-Key (acceso publico)', async () => {
    const req = mockRequest({ accept: 'application/json' });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('body publico contiene solo status, version, timestamp', async () => {
    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(['status', 'version', 'timestamp']);
    expect(body.status).toBe('healthy');
  });

  it('no expone performance ni dependencies en modo publico', async () => {
    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();
    expect(body.performance).toBeUndefined();
    expect(body.dependencies).toBeUndefined();
  });

  it('retorna 200 publico si X-Health-Key es UUID v4 valido pero incorrecto (fallback publico)', async () => {
    // UUID valido en formato pero diferente al configurado en X_HEALTH_KEY
    const req = mockRequest({
      'x-health-key': '550e8400-e29b-41d4-a716-446655440000',
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Modo publico: sin performance ni dependencies
    expect(body.performance).toBeUndefined();
  });
});

// =============================================================================
// BLOQUE 4: HTTP 200 — Modo Privado (X-Health-Key valida y correcta)
// =============================================================================

describe('[B02-V] GET /api/v1/health — HTTP 200 Modo Privado', () => {
  beforeEach(() => {
    mockRunHealthCheck.mockResolvedValue(HEALTHY_RESULT);
  });

  it('retorna 200 con payload completo si la key es valida', async () => {
    const req = mockRequest({
      'x-health-key': process.env.X_HEALTH_KEY!,
      accept: 'application/json',
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('body privado contiene performance y dependencies', async () => {
    const req = mockRequest({ 'x-health-key': process.env.X_HEALTH_KEY! });
    const res = await GET(req);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.performance).toBeDefined();
    expect(body.performance.api_latency_ms).toBeDefined();
    expect(typeof body.performance.api_latency_ms).toBe('number');
    expect(body.dependencies).toBeDefined();
  });

  it('dependencies del modo privado refleja el estado real de los servicios', async () => {
    const req = mockRequest({ 'x-health-key': process.env.X_HEALTH_KEY! });
    const res = await GET(req);
    const body = await res.json();
    expect(body.dependencies.database).toBe('connected');
    expect(body.dependencies.redis).toBe('connected');
    expect(body.dependencies.email_service).toBe('config_valid');
    expect(body.dependencies.captcha_service).toBe('config_valid');
  });

  it('api_latency_ms es un numero no negativo', async () => {
    const req = mockRequest({ 'x-health-key': process.env.X_HEALTH_KEY! });
    const res = await GET(req);
    const body = await res.json();
    expect(body.performance.api_latency_ms).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// BLOQUE 5: HTTP 503 — Servicios criticos caidos
// =============================================================================

describe('[B02-V] GET /api/v1/health — HTTP 503 SYSTEM_DEGRADED', () => {
  beforeEach(() => {
    mockRunHealthCheck.mockResolvedValue(DEGRADED_RESULT);
  });

  it('retorna 503 en modo privado cuando hay fallo critico', async () => {
    const req = mockRequest({ 'x-health-key': process.env.X_HEALTH_KEY! });
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it('retorna 503 en modo publico cuando hay fallo critico', async () => {
    const req = mockRequest({});
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it('body 503 contiene error_code SYSTEM_DEGRADED', async () => {
    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();
    expect(body.error_code).toBe('SYSTEM_DEGRADED');
    expect(body.status).toBe('unhealthy');
  });

  it('body 503 lista los unhealthy_services afectados', async () => {
    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();
    expect(body.unhealthy_services).toContain('database');
  });

  it('body 503 incluye version y timestamp (sistema puede responder sin DB)', async () => {
    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();
    expect(body.version).toBe('1.0.0');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

// =============================================================================
// BLOQUE 6: OPTIONS Preflight CORS
// =============================================================================

describe('[B02-V] OPTIONS /api/v1/health — CORS Preflight', () => {
  it('retorna 204 en respuesta al preflight OPTIONS', () => {
    const req = mockRequest({ origin: 'http://localhost:5173' });
    const res = OPTIONS(req);
    expect(res.status).toBe(204);
  });
});
