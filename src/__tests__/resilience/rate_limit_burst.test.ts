/**
 * TSK-I1-B03-R — rate_limit_burst.test.ts
 * Agente: backend-tester
 * Trazabilidad: PROJECT_spec.md [Iteracion 1 — Rate Limiting Fixed Window, lineas 28-29]
 *
 * FASE RED: Tests de contrato para Rate Limiting (Fixed Window).
 * ESTADO ESPERADO: Los tests marcados [RED] DEBEN FALLAR en esta fase.
 * Su falla confirma la ausencia de implementacion de Rate Limiting.
 * Implementar TSK-I1-B03-G para pasar a GREEN.
 *
 * Contratos validados:
 *   1. Ausencia de limitacion (RED): 11ª peticion publica retorna 200 en vez de 429
 *   2. Headers X-RateLimit-* ausentes en respuestas publicas exitosas (RED)
 *   3. Body 429 con RATE_LIMIT_EXCEEDED y campos SOP completos (RED)
 *   4. Bypass con X-Health-Key incorrecta: aplica rate limit (modo publico) (RED)
 *   5. DB caida con contador activo: debe retornar 503 SYSTEM_DEGRADED (no 429) (RED)
 *
 * Referencia spec:
 *   - "Rate Limiting: 10 req/min por IP. Algoritmo Fixed Window."
 *   - "Exposed Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After"
 *   - "X-RateLimit-Limit: 10 (Solo para Acceso Publico)"
 *   - CLAUDE.md RNF7: bypass exclusivo mediante X-Health-Key UUID
 */

import { GET } from '@/src/app/api/v1/health/route';
import type { NextRequest } from 'next/server';
import type { HealthCheckResult } from '@/src/lib/services/health_service';

// =============================================================================
// Mock del servicio de salud — aísla la lógica del health check del rate limit
// =============================================================================

const mockRunHealthCheck = jest.fn<Promise<HealthCheckResult>, []>();

jest.mock('@/src/lib/services/health_service', () => ({
  runHealthCheck: () => mockRunHealthCheck(),
}));

// =============================================================================
// Mock de ioredis — simula el estado del contador de Rate Limit en Redis.
// Estos metodos son los que el middleware de Rate Limit (TSK-I1-B03-G) usara:
//   - incr(key)  → incrementa el contador de la ventana actual
//   - expire(key, ttl) → establece TTL de la ventana si es la primera peticion
//   - ttl(key)   → consulta segundos restantes para calcular Retry-After
// =============================================================================

const mockIncr = jest.fn<Promise<number>, [string]>();
const mockExpire = jest.fn<Promise<number>, [string, number]>();
const mockTtl = jest.fn<Promise<number>, [string]>();
const mockPing = jest.fn<Promise<string>, []>();
const mockConnect = jest.fn<Promise<void>, []>();
const mockDisconnect = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    incr: mockIncr,
    expire: mockExpire,
    ttl: mockTtl,
    ping: mockPing,
    connect: mockConnect,
    disconnect: mockDisconnect,
  }))
);

// =============================================================================
// Factory de requests mock — incluye x-forwarded-for para simulación de IP
// =============================================================================

function mockRequest(
  headers: Record<string, string> = {},
  ip = '192.168.1.100'
): NextRequest {
  const normalized: Record<string, string> = {
    'x-forwarded-for': ip,
    ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
  };
  return {
    headers: {
      get: (name: string): string | null => normalized[name.toLowerCase()] ?? null,
    },
    ip,
  } as unknown as NextRequest;
}

// =============================================================================
// Fixtures de resultados del health check
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

const DB_FAILURE_RESULT: HealthCheckResult = {
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
// Setup global
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  process.env.X_HEALTH_KEY = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
  // Estado Redis por defecto: primera peticion, 55 segundos de TTL restantes
  mockIncr.mockResolvedValue(1);
  mockExpire.mockResolvedValue(1);
  mockTtl.mockResolvedValue(55);
  mockConnect.mockResolvedValue(undefined);
  mockPing.mockResolvedValue('PONG');
  mockRunHealthCheck.mockResolvedValue(HEALTHY_RESULT);
});

afterEach(() => {
  delete process.env.X_HEALTH_KEY;
});

// =============================================================================
// BLOQUE 1 — Ausencia de Rate Limiting (Confirmacion RED)
// Spec: "Rate Limiting: 10 req/min por IP. Algoritmo Fixed Window."
// =============================================================================

describe('[B03-R] Rate Limiting Fixed Window — Ausencia de limite (RED)', () => {
  // [CONTROL] Verifica linea base: la 1ª peticion siempre debe funcionar
  it('[CONTROL] primera peticion publica retorna 200 OK', async () => {
    const req = mockRequest({});
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  // [RED] La 11ª peticion publica (contador Redis = 11) debe retornar 429.
  // Falla esperada: la ruta retorna 200 porque no existe middleware de rate limit.
  it('[RED] la 11ª peticion publica debe retornar 429 RATE_LIMIT_EXCEEDED', async () => {
    mockIncr.mockResolvedValue(11); // Redis indica ventana agotada
    mockTtl.mockResolvedValue(45);  // 45s hasta el reset de ventana

    const req = mockRequest({}, '10.0.0.1');
    const res = await GET(req);

    expect(res.status).toBe(429);
  });

  // [RED] Cuerpo del 429 debe cumplir el contrato SOP completo
  it('[RED] body del 429 contiene error_code RATE_LIMIT_EXCEEDED y campos SOP', async () => {
    mockIncr.mockResolvedValue(11);

    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();

    expect(body.error_code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.status).toBe('unhealthy');
    expect(body.version).toBe('1.0.0');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  // [RED] El mensaje del 429 debe referenciar el limite de 10 req/min
  it('[RED] body del 429 incluye message que referencia el limite de 10 req/min', async () => {
    mockIncr.mockResolvedValue(11);

    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();

    expect(body.message).toMatch(/10 req\/min/i);
  });

  // [RED] La peticion en el exacto limite (contador = 10) AUN debe ser 200
  it('[RED] la 10ª peticion exacta (contador = 10) aun retorna 200 OK', async () => {
    mockIncr.mockResolvedValue(10); // Exactamente en el limite, no excedido

    const req = mockRequest({});
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  // [RED] Dos IPs distintas deben tener contadores independientes
  it('[RED] IPs distintas tienen contadores independientes (IP A=429, IP B=200)', async () => {
    // IP A tiene contador excedido
    mockIncr.mockResolvedValueOnce(11);
    const resA = await GET(mockRequest({}, '10.0.0.1'));
    expect(resA.status).toBe(429);

    // IP B tiene contador en 1 (primera peticion)
    mockIncr.mockResolvedValueOnce(1);
    const resB = await GET(mockRequest({}, '10.0.0.2'));
    expect(resB.status).toBe(200);
  });
});

// =============================================================================
// BLOQUE 2 — Headers X-RateLimit-* en respuestas publicas (RED)
// Spec: "Exposed Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset"
// =============================================================================

describe('[B03-R] Headers X-RateLimit-* — Ausentes en respuestas actuales (RED)', () => {
  // [RED] Respuesta 200 publica debe incluir X-RateLimit-Limit: 10
  it('[RED] respuesta publica exitosa incluye header X-RateLimit-Limit con valor 10', async () => {
    const req = mockRequest({});
    const res = await GET(req);

    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
  });

  // [RED] Respuesta 200 incluye X-RateLimit-Remaining calculado desde el contador
  it('[RED] respuesta publica incluye X-RateLimit-Remaining = 10 - contador', async () => {
    mockIncr.mockResolvedValue(3); // 3ª peticion → 7 restantes
    const req = mockRequest({});
    const res = await GET(req);

    expect(res.headers.get('X-RateLimit-Remaining')).toBe('7');
  });

  // [RED] Respuesta 200 incluye X-RateLimit-Remaining = 0 cuando está en el límite exacto
  it('[RED] X-RateLimit-Remaining es 0 cuando contador = 10 (ultima peticion permitida)', async () => {
    mockIncr.mockResolvedValue(10);
    const req = mockRequest({});
    const res = await GET(req);

    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  // [RED] Respuesta 200 incluye X-RateLimit-Reset como Unix epoch valido
  it('[RED] respuesta publica incluye X-RateLimit-Reset como numero Unix epoch', async () => {
    const req = mockRequest({});
    const res = await GET(req);

    const resetHeader = res.headers.get('X-RateLimit-Reset');
    expect(resetHeader).not.toBeNull();
    const resetValue = Number(resetHeader);
    expect(Number.isInteger(resetValue)).toBe(true);
    // El reset debe ser en el futuro (mayor al epoch actual en segundos)
    expect(resetValue).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  // [RED] Respuesta 429 incluye Retry-After = TTL restante de la ventana
  it('[RED] respuesta 429 incluye header Retry-After igual al TTL de Redis', async () => {
    mockIncr.mockResolvedValue(11);
    mockTtl.mockResolvedValue(42); // 42 segundos hasta el reset

    const req = mockRequest({});
    const res = await GET(req);

    expect(res.headers.get('Retry-After')).toBe('42');
  });

  // [RED] Respuesta 429 tambien incluye X-RateLimit-* (spec: "incluso en 4xx si aplican")
  it('[RED] respuesta 429 incluye X-RateLimit-Limit y X-RateLimit-Remaining: 0', async () => {
    mockIncr.mockResolvedValue(11);

    const req = mockRequest({});
    const res = await GET(req);

    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  // [SPEC-CHECK] Acceso privado con X-Health-Key valida NO debe tener X-RateLimit-Limit
  // Spec: "X-RateLimit-Limit: 10 (Solo para Acceso Publico)" — exento de rate limit
  it('[SPEC-CHECK] acceso privado con llave valida no expone X-RateLimit-Limit', async () => {
    const req = mockRequest({ 'x-health-key': process.env.X_HEALTH_KEY! });
    const res = await GET(req);

    // En GREEN: header ausente porque modo privado está exento
    // En RED: header ausente por otra razon (no hay rate limit)
    // En ambos casos el resultado es null — test pasa en RED y GREEN
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
  });
});

// =============================================================================
// BLOQUE 3 — Bypass de Rate Limit (X-Health-Key incorrecta aplica limite) (RED)
// Spec: "Acceso Privado: Exento de Rate Limit" (solo con llave correcta)
// =============================================================================

describe('[B03-R] Bypass de Rate Limit — Llave incorrecta no exime del limite (RED)', () => {
  // [RED] Con X-Health-Key UUID valido pero incorrecto = modo publico = rate limit aplica
  it('[RED] llave UUID valida pero incorrecta con contador=11 retorna 429', async () => {
    const wrongKey = '550e8400-e29b-41d4-a716-446655440000'; // UUID v4 valido, llave incorrecta
    mockIncr.mockResolvedValue(11);

    const req = mockRequest({ 'x-health-key': wrongKey });
    const res = await GET(req);

    // Con llave incorrecta → modo publico → rate limit aplica → 429
    expect(res.status).toBe(429);
  });

  // [RED] Sin X-Health-Key y contador=11 retorna 429 (acceso anonimo publico)
  it('[RED] acceso anonimo (sin llave) con contador=11 retorna 429', async () => {
    mockIncr.mockResolvedValue(11);

    const req = mockRequest({}); // Sin header X-Health-Key
    const res = await GET(req);

    expect(res.status).toBe(429);
  });

  // [CONTROL] Con llave correcta y contador=11, retorna 200 (bypass del rate limit)
  // NOTA: En RED este test pasa accidentalmente (no hay rate limit).
  // En GREEN pasa correctamente porque la llave bypasea el middleware.
  it('[CONTROL] llave correcta con contador=11 retorna 200 (bypass funcional)', async () => {
    mockIncr.mockResolvedValue(11);

    const req = mockRequest({ 'x-health-key': process.env.X_HEALTH_KEY! });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error_code).toBeUndefined();
  });
});

// =============================================================================
// BLOQUE 4 — Caida de DB en contexto de Rate Limit (RED)
// B03-G DoD: "atrapa excepciones de DB para mutar el payload"
// =============================================================================

describe('[B03-R] Caida de DB con Rate Limit activo (RED)', () => {
  // [CONTROL] DB caida base: ya retorna 503 SYSTEM_DEGRADED (comportamiento B02)
  it('[CONTROL] DB caida retorna 503 SYSTEM_DEGRADED (comportamiento base de B02)', async () => {
    mockRunHealthCheck.mockResolvedValue(DB_FAILURE_RESULT);

    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error_code).toBe('SYSTEM_DEGRADED');
    expect(body.unhealthy_services).toContain('database');
  });

  // [RED] DB caida con contador dentro del limite (contador=5): debe retornar 503, no 429
  // El rate limit NO debe tener precedencia sobre un fallo critico de infraestructura
  it('[RED] DB caida con contador=5 retorna 503 SYSTEM_DEGRADED (no 429)', async () => {
    mockIncr.mockResolvedValue(5); // Dentro del limite
    mockRunHealthCheck.mockResolvedValue(DB_FAILURE_RESULT);

    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error_code).toBe('SYSTEM_DEGRADED');
  });

  // [RED] runHealthCheck que lanza excepcion (no solo retorna disconnected)
  // produce 503 SYSTEM_DEGRADED — no una excepcion no manejada (500)
  it('[RED] excepcion en runHealthCheck produce 503 SYSTEM_DEGRADED (no crash 500)', async () => {
    mockRunHealthCheck.mockRejectedValue(new Error('DB connection pool exhausted'));

    const req = mockRequest({});
    const res = await GET(req);

    // Falla esperada: la ruta no tiene try/catch alrededor de runHealthCheck → crash
    // En GREEN: el middleware captura la excepcion y emite 503
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error_code).toBe('SYSTEM_DEGRADED');
  });
});
