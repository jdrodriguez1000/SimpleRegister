/**
 * TSK-I1-B02-V — health_service.test.ts
 * Agente: backend-tester
 * Cobertura objetivo: src/lib/services/health_service.ts → >90%
 *
 * Los clientes externos (pg, ioredis) se mockean para mantener independencia
 * de entorno. Ningun test requiere contenedores levantados.
 */

import { runHealthCheck } from '@/src/lib/services/health_service';

// =============================================================================
// Mocks de clientes externos
// =============================================================================

// Mock del cliente PostgreSQL
const mockPgConnect = jest.fn();
const mockPgQuery = jest.fn();
const mockPgEnd = jest.fn().mockResolvedValue(undefined);

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockPgConnect,
    query: mockPgQuery,
    end: mockPgEnd,
  })),
}));

// Mock del cliente Redis (ioredis v5 — default export = clase constructor)
const mockRedisConnect = jest.fn();
const mockRedisPing = jest.fn();
const mockRedisDisconnect = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    connect: mockRedisConnect,
    ping: mockRedisPing,
    disconnect: mockRedisDisconnect,
  }))
);

// =============================================================================
// Setup de variables de entorno
// =============================================================================

const ENV_BASELINE: Record<string, string> = {
  POSTGRES_HOST: 'db',
  POSTGRES_PORT: '5432',
  POSTGRES_DB: 'simpleregister',
  POSTGRES_USER: 'sr_app',
  POSTGRES_PASSWORD: 'test_password',
  REDIS_HOST: 'redis',
  REDIS_PORT: '6379',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'noreply@example.com',
  SMTP_PASS: 'smtp_pass',
  SMTP_FROM: 'SimpleRegister <noreply@example.com>',
  CAPTCHA_SECRET_KEY: 'valid-captcha-secret-key-not-placeholder',
};

beforeEach(() => {
  jest.clearAllMocks();
  // Limpiar y setear variables de entorno para cada test
  Object.keys(ENV_BASELINE).forEach((key) => {
    process.env[key] = ENV_BASELINE[key];
  });
});

afterEach(() => {
  // Limpiar las vars seteadas en el test
  Object.keys(ENV_BASELINE).forEach((key) => {
    delete process.env[key];
  });
});

// =============================================================================
// BLOQUE 1: Escenario nominal — todos los servicios saludables
// =============================================================================

describe('[B02-V] runHealthCheck — escenario nominal (todos UP)', () => {
  beforeEach(() => {
    mockPgConnect.mockResolvedValue(undefined);
    mockPgQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue('PONG');
  });

  it('retorna hasCriticalFailure=false cuando DB y Redis responden', async () => {
    const result = await runHealthCheck();
    expect(result.hasCriticalFailure).toBe(false);
  });

  it('dependencies.database es "connected"', async () => {
    const result = await runHealthCheck();
    expect(result.dependencies.database).toBe('connected');
  });

  it('dependencies.redis es "connected"', async () => {
    const result = await runHealthCheck();
    expect(result.dependencies.redis).toBe('connected');
  });

  it('dependencies.email_service es "config_valid" cuando todas las vars SMTP existen', async () => {
    const result = await runHealthCheck();
    expect(result.dependencies.email_service).toBe('config_valid');
  });

  it('dependencies.captcha_service es "config_valid" cuando CAPTCHA_SECRET_KEY no es el placeholder', async () => {
    const result = await runHealthCheck();
    expect(result.dependencies.captcha_service).toBe('config_valid');
  });

  it('unhealthyServices esta vacio', async () => {
    const result = await runHealthCheck();
    expect(result.unhealthyServices).toHaveLength(0);
  });
});

// =============================================================================
// BLOQUE 2: Fallo de DB
// =============================================================================

describe('[B02-V] runHealthCheck — DB disconnected', () => {
  beforeEach(() => {
    mockPgConnect.mockRejectedValue(new Error('ECONNREFUSED'));
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue('PONG');
  });

  it('dependencies.database es "disconnected" cuando pg.connect() falla', async () => {
    const result = await runHealthCheck();
    expect(result.dependencies.database).toBe('disconnected');
  });

  it('hasCriticalFailure es true', async () => {
    const result = await runHealthCheck();
    expect(result.hasCriticalFailure).toBe(true);
  });

  it('unhealthyServices incluye "database"', async () => {
    const result = await runHealthCheck();
    expect(result.unhealthyServices).toContain('database');
  });

  it('Redis sigue conectado a pesar del fallo de DB', async () => {
    const result = await runHealthCheck();
    expect(result.dependencies.redis).toBe('connected');
  });
});

// =============================================================================
// BLOQUE 3: Fallo de Redis
// =============================================================================

describe('[B02-V] runHealthCheck — Redis disconnected', () => {
  beforeEach(() => {
    mockPgConnect.mockResolvedValue(undefined);
    mockPgQuery.mockResolvedValue({});
    mockRedisConnect.mockRejectedValue(new Error('Connection refused'));
  });

  it('dependencies.redis es "disconnected" cuando ioredis.connect() falla', async () => {
    const result = await runHealthCheck();
    expect(result.dependencies.redis).toBe('disconnected');
  });

  it('hasCriticalFailure es true', async () => {
    const result = await runHealthCheck();
    expect(result.hasCriticalFailure).toBe(true);
  });

  it('unhealthyServices incluye "redis"', async () => {
    const result = await runHealthCheck();
    expect(result.unhealthyServices).toContain('redis');
  });
});

// =============================================================================
// BLOQUE 4: Fallo simultaneo de DB y Redis (peor caso)
// =============================================================================

describe('[B02-V] runHealthCheck — DB y Redis ambos disconnected', () => {
  beforeEach(() => {
    mockPgConnect.mockRejectedValue(new Error('ECONNREFUSED'));
    mockRedisConnect.mockRejectedValue(new Error('ECONNREFUSED'));
  });

  it('ambas dependencias criticas reportan "disconnected"', async () => {
    const result = await runHealthCheck();
    expect(result.dependencies.database).toBe('disconnected');
    expect(result.dependencies.redis).toBe('disconnected');
  });

  it('unhealthyServices contiene ambos servicios', async () => {
    const result = await runHealthCheck();
    expect(result.unhealthyServices).toContain('database');
    expect(result.unhealthyServices).toContain('redis');
  });
});

// =============================================================================
// BLOQUE 5: Redis PONG incorrecto (respuesta valida pero inesperada)
// =============================================================================

describe('[B02-V] runHealthCheck — Redis responde pero no PONG', () => {
  beforeEach(() => {
    mockPgConnect.mockResolvedValue(undefined);
    mockPgQuery.mockResolvedValue({});
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue('NOT_PONG');
  });

  it('dependencies.redis es "disconnected" si PING no retorna "PONG"', async () => {
    const result = await runHealthCheck();
    expect(result.dependencies.redis).toBe('disconnected');
  });
});

// =============================================================================
// BLOQUE 6: Validacion de configuracion de Email
// =============================================================================

describe('[B02-V] runHealthCheck — Email Service config', () => {
  beforeEach(() => {
    mockPgConnect.mockResolvedValue(undefined);
    mockPgQuery.mockResolvedValue({});
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue('PONG');
  });

  it('email_service es "error" si SMTP_HOST esta ausente', async () => {
    delete process.env.SMTP_HOST;
    const result = await runHealthCheck();
    expect(result.dependencies.email_service).toBe('error');
  });

  it('email_service es "error" si SMTP_PASS esta vacia', async () => {
    process.env.SMTP_PASS = '';
    const result = await runHealthCheck();
    expect(result.dependencies.email_service).toBe('error');
  });

  it('email_service es "config_valid" cuando todas las vars SMTP estan presentes', async () => {
    const result = await runHealthCheck();
    expect(result.dependencies.email_service).toBe('config_valid');
  });
});

// =============================================================================
// BLOQUE 7: Validacion de configuracion de Captcha
// =============================================================================

describe('[B02-V] runHealthCheck — Captcha Service config', () => {
  beforeEach(() => {
    mockPgConnect.mockResolvedValue(undefined);
    mockPgQuery.mockResolvedValue({});
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue('PONG');
  });

  it('captcha_service es "error" si CAPTCHA_SECRET_KEY es el placeholder', async () => {
    process.env.CAPTCHA_SECRET_KEY = 'CHANGE_ME_CAPTCHA_SECRET_KEY';
    const result = await runHealthCheck();
    expect(result.dependencies.captcha_service).toBe('error');
  });

  it('captcha_service es "error" si CAPTCHA_SECRET_KEY esta ausente', async () => {
    delete process.env.CAPTCHA_SECRET_KEY;
    const result = await runHealthCheck();
    expect(result.dependencies.captcha_service).toBe('error');
  });

  it('captcha_service es "config_valid" cuando CAPTCHA_SECRET_KEY es una clave real', async () => {
    const result = await runHealthCheck();
    expect(result.dependencies.captcha_service).toBe('config_valid');
  });
});

// =============================================================================
// BLOQUE 8: Cobertura de ramas — fallback defaults y callbacks anonimos
// Referencia: informe de cobertura TSK-I1-B02-V (health_service.ts 85% branches)
// =============================================================================

describe('[B02-V] health_service — fallback a valores por defecto (env vars ausentes)', () => {
  beforeEach(() => {
    // Eliminar todas las vars de infraestructura para disparar los fallbacks ??
    ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER',
     'REDIS_HOST', 'REDIS_PORT'].forEach((k) => delete process.env[k]);
    mockPgConnect.mockResolvedValue(undefined);
    mockPgQuery.mockResolvedValue({});
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue('PONG');
  });

  it('usa valores por defecto (db/5432/redis/6379) cuando las vars no estan configuradas', async () => {
    // Cubre las ramas: ?? 'db', ?? '5432', ?? 'redis', ?? '6379', etc.
    const result = await runHealthCheck();
    expect(result.dependencies.database).toBe('connected');
    expect(result.dependencies.redis).toBe('connected');
  });
});

describe('[B02-V] health_service — callback .catch() en client.end()', () => {
  it('el finally de checkDatabase absorbe errores de end() silenciosamente', async () => {
    // Cubre la rama: el callback anonimo () => undefined de client.end().catch(...)
    mockPgConnect.mockResolvedValue(undefined);
    mockPgQuery.mockResolvedValue({});
    mockPgEnd.mockRejectedValue(new Error('end() failed'));
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue('PONG');

    // A pesar de que end() falla, el resultado sigue siendo connected
    const result = await runHealthCheck();
    expect(result.dependencies.database).toBe('connected');
  });
});
