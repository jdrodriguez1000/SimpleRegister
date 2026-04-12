/**
 * health_service.ts — Logica de Dominio para el Health Check
 * Trazabilidad: TSK-I1-B02-G — "validacion de servicios externos"
 * Agente: backend-coder
 *
 * Responsabilidad: orquestar las verificaciones de conectividad y configuracion
 * de todas las dependencias del sistema. No conoce detalles del framework HTTP.
 *
 * Dependencias criticas (su fallo dispara HTTP 503):
 *   - database (PostgreSQL 16)
 *   - redis    (Redis 7)
 *
 * Dependencias no criticas (solo validacion de config):
 *   - email_service (SMTP vars)
 *   - captcha_service (CAPTCHA_SECRET_KEY)
 */

import { Client as PgClient } from 'pg';
import Redis from 'ioredis';
import type { ConnectionStatus, ConfigStatus, DependencyStatus } from '@/src/lib/types/health_types';

// Re-exportar para que los consumidores de health_service no necesiten
// conocer la ubicacion de health_types directamente.
export type { DependencyStatus } from '@/src/lib/types/health_types';

// =============================================================================
// Tipos de dominio propios del servicio
// =============================================================================

export interface HealthCheckResult {
  dependencies: DependencyStatus;
  hasCriticalFailure: boolean;
  unhealthyServices: string[];
}

// =============================================================================
// Helpers de timeout (evita que un servicio caido congele la peticion)
// =============================================================================

const SERVICE_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const timeout = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms));
  return Promise.race([promise, timeout]);
}

// =============================================================================
// Verificacion de dependencias individuales
// =============================================================================

async function checkDatabase(): Promise<ConnectionStatus> {
  const client = new PgClient({
    host: process.env.POSTGRES_HOST ?? 'db',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    database: process.env.POSTGRES_DB ?? 'simpleregister',
    user: process.env.POSTGRES_USER ?? 'sr_app',
    password: process.env.POSTGRES_PASSWORD,
    connectionTimeoutMillis: SERVICE_TIMEOUT_MS,
    statement_timeout: SERVICE_TIMEOUT_MS,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return 'connected';
  } catch {
    return 'disconnected';
  } finally {
    // end() es silencioso si la conexion nunca se establecio
    await client.end().catch(() => undefined);
  }
}

async function checkRedis(): Promise<ConnectionStatus> {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'redis',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    connectTimeout: SERVICE_TIMEOUT_MS,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
  });
  try {
    await redis.connect();
    const pong = await redis.ping();
    return pong === 'PONG' ? 'connected' : 'disconnected';
  } catch {
    return 'disconnected';
  } finally {
    redis.disconnect();
  }
}

/**
 * Valida configuracion de SMTP sin realizar una conexion real.
 * Estado 'config_valid' si todas las variables obligatorias estan presentes y no vacias.
 */
function checkEmailServiceConfig(): ConfigStatus {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const allPresent = required.every(
    (key) => process.env[key] && process.env[key]!.trim().length > 0
  );
  return allPresent ? 'config_valid' : 'error';
}

/**
 * Valida configuracion de Captcha sin realizar una llamada real a la API.
 * Estado 'config_valid' si CAPTCHA_SECRET_KEY esta presente y no es el valor placeholder.
 */
function checkCaptchaServiceConfig(): ConfigStatus {
  const secret = process.env.CAPTCHA_SECRET_KEY;
  if (!secret || secret.trim().length === 0) return 'error';
  if (secret === 'CHANGE_ME_CAPTCHA_SECRET_KEY') return 'error';
  return 'config_valid';
}

// =============================================================================
// Orquestador principal
// =============================================================================

/**
 * Ejecuta todas las verificaciones en paralelo y retorna el resultado consolidado.
 * Usa Promise.all para maximizar el paralelismo y minimizar la latencia total.
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const [dbStatus, redisStatus] = await Promise.all([
    withTimeout(checkDatabase(), SERVICE_TIMEOUT_MS + 500, 'disconnected' as ConnectionStatus),
    withTimeout(checkRedis(), SERVICE_TIMEOUT_MS + 500, 'disconnected' as ConnectionStatus),
  ]);

  const emailStatus = checkEmailServiceConfig();
  const captchaStatus = checkCaptchaServiceConfig();

  const dependencies: DependencyStatus = {
    database: dbStatus,
    redis: redisStatus,
    email_service: emailStatus,
    captcha_service: captchaStatus,
  };

  const unhealthyServices: string[] = [];
  if (dbStatus === 'disconnected') unhealthyServices.push('database');
  if (redisStatus === 'disconnected') unhealthyServices.push('redis');

  return {
    dependencies,
    hasCriticalFailure: unhealthyServices.length > 0,
    unhealthyServices,
  };
}
