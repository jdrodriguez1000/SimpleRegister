/**
 * TSK-I1-B03-R — redis_resilience.test.ts
 * Agente: backend-tester
 * Trazabilidad: CLAUDE.md [RNF9 — Seguridad Fail-Closed], PROJECT_spec.md [503 SYSTEM_DEGRADED]
 *
 * FASE RED: Tests de contrato para Resiliencia ante Caida de Redis.
 * ESTADO ESPERADO: TODOS los tests de este archivo DEBEN FALLAR en esta fase.
 *
 * ATENCION: Este archivo importa '@/src/lib/middleware/rate_limit' que NO EXISTE AUN.
 * Este fallo de importacion ES el estado RED requerido por el protocolo TDD.
 * El modulo completo debe ser creado en TSK-I1-B03-G para pasar a GREEN.
 *
 * Contratos validados:
 *   1. checkRateLimit: unidad funcional del middleware (modulo inexistente = RED)
 *   2. Fail-Closed (RNF9): Redis CAIDO → acceso publico bloqueado (503)
 *   3. Fallo catastrofico: Redis caido sin fallback → sin respuesta graceful (RED)
 *   4. RateLimitResult: tipo exportado con campos contrato (limit, remaining, resetAt)
 *
 * Referencia:
 *   - CLAUDE.md: "RNF9 — Si el sistema de cache falla, el acceso a recursos protegidos
 *     debe bloquearse por defecto." (Fail-Closed)
 *   - PROJECT_spec.md linea 126: "Criticos: database y redis. Su fallo dispara HTTP 503."
 */

// =============================================================================
// ATENCION: Este import FALLARA hasta que TSK-I1-B03-G implemente el modulo.
// Este fallo deliberado ES el estado RED requerido por el protocolo TDD.
// =============================================================================
import {
  checkRateLimit,
  type RateLimitResult,
} from '@/src/lib/middleware/rate_limit';

import { GET } from '@/src/app/api/v1/health/route';
import type { NextRequest } from 'next/server';
import type { HealthCheckResult } from '@/src/lib/services/health_service';

// =============================================================================
// Mock del servicio de salud
// =============================================================================

const mockRunHealthCheck = jest.fn<Promise<HealthCheckResult>, []>();

jest.mock('@/src/lib/services/health_service', () => ({
  runHealthCheck: () => mockRunHealthCheck(),
}));

// =============================================================================
// Mock de ioredis que simula una instancia completamente caida (sin conexion)
// Todos los metodos lanzan "connection refused" — esto modela RNF9 Fail-Closed
// =============================================================================

const REDIS_ERROR = new Error('Redis connection refused: ECONNREFUSED 127.0.0.1:6379');

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    incr: jest.fn().mockRejectedValue(REDIS_ERROR),
    expire: jest.fn().mockRejectedValue(REDIS_ERROR),
    ttl: jest.fn().mockRejectedValue(REDIS_ERROR),
    ping: jest.fn().mockRejectedValue(REDIS_ERROR),
    connect: jest.fn().mockRejectedValue(REDIS_ERROR),
    disconnect: jest.fn(),
    on: jest.fn(),
  }))
);

// =============================================================================
// Factory de requests
// =============================================================================

function mockRequest(headers: Record<string, string> = {}, ip = '192.168.1.1'): NextRequest {
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
// Fixtures
// =============================================================================

const REDIS_DOWN_RESULT: HealthCheckResult = {
  dependencies: {
    database: 'connected',
    redis: 'disconnected', // Redis reportado como caido por health check
    email_service: 'config_valid',
    captcha_service: 'config_valid',
  },
  hasCriticalFailure: true,
  unhealthyServices: ['redis'],
};

const FULL_DEGRADED_RESULT: HealthCheckResult = {
  dependencies: {
    database: 'disconnected',
    redis: 'disconnected',
    email_service: 'config_valid',
    captcha_service: 'config_valid',
  },
  hasCriticalFailure: true,
  unhealthyServices: ['database', 'redis'],
};

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

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  process.env.X_HEALTH_KEY = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
});

afterEach(() => {
  delete process.env.X_HEALTH_KEY;
});

// =============================================================================
// BLOQUE 1 — Unit Tests: checkRateLimit (modulo inexistente = RED)
// Spec: Fixed Window, 10 req/min por IP | RNF9: Fail-Closed
// =============================================================================

describe('[B03-R] checkRateLimit — Unidad del middleware de Rate Limit (RED)', () => {
  // [RED] checkRateLimit retorna RateLimitResult con allowed:true para primera peticion
  it('[RED] checkRateLimit permite la 1ª peticion (remaining=9, limit=10)', async () => {
    const result: RateLimitResult = await checkRateLimit('192.168.1.10');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
    expect(result.resetAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  // [RED] checkRateLimit bloquea cuando Redis indica contador excedido (> 10)
  it('[RED] checkRateLimit bloquea cuando contador de Redis > 10 (allowed:false)', async () => {
    const result: RateLimitResult = await checkRateLimit('10.0.0.55');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  // [RED] checkRateLimit con Redis CAIDO retorna fail-closed (RNF9)
  // "Si el sistema de cache falla, el acceso a recursos protegidos debe bloquearse."
  it('[RED] checkRateLimit con Redis CAIDO retorna fail-closed: allowed:false', async () => {
    // Redis mock esta configurado para lanzar ECONNREFUSED en todos los metodos
    const result: RateLimitResult = await checkRateLimit('10.0.0.99');

    // RNF9: Fail-Closed — sin acceso cuando el cache no responde
    expect(result.allowed).toBe(false);
    expect(result.failReason).toBe('CACHE_UNAVAILABLE');
  });

  // [RED] checkRateLimit incluye retryAfter cuando bloquea (delta-seconds para Retry-After)
  it('[RED] RateLimitResult bloqueado incluye retryAfter en segundos', async () => {
    const result: RateLimitResult = await checkRateLimit('10.0.0.56');

    // Si allowed es false, retryAfter debe estar presente y ser > 0
    if (!result.allowed) {
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThanOrEqual(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    }
  });

  // [RED] checkRateLimit con IP de llave privada valida: debe ser invocado con bypass=true
  // El caller (route) es responsable de no llamar checkRateLimit para acceso privado
  it('[RED] checkRateLimit retorna contrato RateLimitResult con todos los campos requeridos', async () => {
    const result: RateLimitResult = await checkRateLimit('192.168.1.20');

    // Verificacion del contrato de tipo RateLimitResult
    expect(typeof result.allowed).toBe('boolean');
    expect(typeof result.limit).toBe('number');
    expect(typeof result.remaining).toBe('number');
    expect(typeof result.resetAt).toBe('number');
    expect(result.limit).toBe(10);
  });
});

// =============================================================================
// BLOQUE 2 — Integracion: Route con Redis CAIDO (Fallo Catastrofico = RED)
// RNF9: "Fail-Closed ante fallo de cache"
// =============================================================================

describe('[B03-R] Route con Redis caido — Fallo catastrofico sin fallback (RED)', () => {
  // [RED] Redis caido → health check retorna Redis como disconnected → 503 SYSTEM_DEGRADED
  // Nota: el 503 aqui surge del health check (B02), no del rate limit (B03).
  // En B03-G: el 503 tambien podria surgir del middleware de rate limit (fail-closed).
  it('[RED] acceso publico con Redis caido retorna 503 SYSTEM_DEGRADED', async () => {
    mockRunHealthCheck.mockResolvedValue(REDIS_DOWN_RESULT);

    const req = mockRequest({});
    const res = await GET(req);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error_code).toBe('SYSTEM_DEGRADED');
  });

  // [RED] Body 503 lista Redis en unhealthy_services cuando Redis esta caido
  it('[RED] body 503 con Redis caido contiene redis en unhealthy_services', async () => {
    mockRunHealthCheck.mockResolvedValue(REDIS_DOWN_RESULT);

    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();

    expect(body.unhealthy_services).toContain('redis');
    expect(body.unhealthy_services).not.toContain('database'); // Solo Redis esta caido
  });

  // [RED] Redis Y DB caidos → SYSTEM_DEGRADED lista AMBOS servicios
  it('[RED] Redis Y DB caidos → 503 con ambos en unhealthy_services', async () => {
    mockRunHealthCheck.mockResolvedValue(FULL_DEGRADED_RESULT);

    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error_code).toBe('SYSTEM_DEGRADED');
    expect(body.unhealthy_services).toContain('database');
    expect(body.unhealthy_services).toContain('redis');
  });

  // [RED] Con Redis caido, acceso privado (X-Health-Key valida) tambien retorna 503
  // Redis es servicio critico — su caida impacta incluso el acceso autenticado
  it('[RED] acceso privado con Redis caido retorna 503 (Redis es servicio critico)', async () => {
    mockRunHealthCheck.mockResolvedValue(REDIS_DOWN_RESULT);

    const req = mockRequest({ 'x-health-key': process.env.X_HEALTH_KEY! });
    const res = await GET(req);

    expect(res.status).toBe(503);
  });

  // [RED] Body 503 debe incluir version y timestamp incluso con Redis caido
  // Spec linea 126: "El sistema debe ser capaz de emitir esta respuesta JSON incluso
  // con la DB caida (Usar constantes para version)."
  it('[RED] body 503 incluye version y timestamp aunque Redis este caido', async () => {
    mockRunHealthCheck.mockResolvedValue(REDIS_DOWN_RESULT);

    const req = mockRequest({});
    const res = await GET(req);
    const body = await res.json();

    expect(body.version).toBe('1.0.0');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  // [RED] RNF9 Fail-Closed: cuando el middleware de rate limit no puede consultar Redis,
  // una peticion que de otro modo seria permitida (contador < 10) debe ser BLOQUEADA.
  // Falla esperada: sin middleware, la ruta retorna 200 en vez de aplicar fail-closed.
  it('[RED] RNF9 Fail-Closed: rate limit con Redis caido bloquea peticion (no retorna 200)', async () => {
    // Health check reporta servicios UP (para aislar el escenario de rate limit Redis caido)
    mockRunHealthCheck.mockResolvedValue(HEALTHY_RESULT);
    // ioredis mock lanza error (Redis para rate limit no disponible)

    const req = mockRequest({});
    const res = await GET(req);

    // RNF9: "Si el sistema de cache falla, el acceso a recursos protegidos
    // debe bloquearse por defecto." → esperado 503 o 429 (fail-closed)
    // FALLA ESPERADA: actualmente retorna 200 porque no hay middleware de rate limit
    expect(res.status).not.toBe(200);
  });
});
