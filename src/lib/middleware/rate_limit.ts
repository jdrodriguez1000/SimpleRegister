/**
 * rate_limit.ts — Middleware de Rate Limiting (Fixed Window)
 * Trazabilidad: TSK-I1-B03-G — PROJECT_spec.md [Iteracion 1, lineas 28-29]
 * Agente: backend-coder
 *
 * Responsabilidad unica: evaluar si una IP ha excedido su cuota de peticiones
 * consultando y actualizando un contador en Redis (Fixed Window, 60s).
 *
 * Algoritmo Fixed Window:
 *   1. INCR rate_limit:{ip}          — incrementa (o crea) el contador
 *   2. EXPIRE rate_limit:{ip} 60     — establece TTL solo en la primera peticion
 *   3. TTL rate_limit:{ip}           — obtiene segundos restantes para Retry-After
 *   4. Si count > LIMIT → bloqueado (429)
 *   5. Si Redis falla → Fail-Closed (RNF9): bloquear acceso, failReason=CACHE_UNAVAILABLE
 *
 * Dependencias: ioredis (instalado, no requiere instalacion adicional)
 *
 * NO tiene conocimiento de HTTP, Next.js ni headers — esa logica queda en route.ts.
 */

import Redis from 'ioredis';

// =============================================================================
// Contrato de resultado — espejo del tipo esperado por la suite de tests (B03-R)
// =============================================================================

export interface RateLimitResult {
  /** true si la peticion esta dentro del limite, false si fue bloqueada */
  allowed: boolean;
  /** Limite maximo de peticiones por ventana (siempre 10) */
  limit: number;
  /** Peticiones restantes en la ventana actual */
  remaining: number;
  /** Unix epoch (segundos) del proximo reset de ventana */
  resetAt: number;
  /** Delta-seconds para el header Retry-After (solo cuando allowed=false) */
  retryAfter?: number;
  /** Razon de bloqueo cuando Redis no esta disponible (RNF9 Fail-Closed) */
  failReason?: 'CACHE_UNAVAILABLE';
}

// =============================================================================
// Constantes del algoritmo
// =============================================================================

const RATE_LIMIT = 10;
const WINDOW_SECONDS = 60;
const CONNECT_TIMEOUT_MS = 2_000;

// =============================================================================
// checkRateLimit — funcion publica del modulo
// =============================================================================

/**
 * Evalua si la IP dada puede realizar una peticion mas dentro de su ventana actual.
 *
 * @param ip - Direccion IP del cliente (extraida por el caller desde x-forwarded-for)
 * @returns RateLimitResult con la decision (allowed) y los valores para headers HTTP
 *
 * Comportamiento ante fallo de Redis (RNF9 Fail-Closed):
 *   Si el cliente Redis lanza cualquier excepcion, se retorna:
 *   { allowed: false, failReason: 'CACHE_UNAVAILABLE', retryAfter: 60 }
 *   Esto garantiza que el acceso quede BLOQUEADO y no se omita la limitacion.
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'redis',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    connectTimeout: CONNECT_TIMEOUT_MS,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
  });

  try {
    await redis.connect();

    const key = `rate_limit:${ip}`;

    // Incrementar contador. Si la clave no existia, INCR la crea con valor 1.
    const count = await redis.incr(key);

    // Solo en la primera peticion de la ventana se establece el TTL de 60s.
    // Peticiones posteriores conservan el TTL original (Fixed Window semantics).
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    // Segundos restantes hasta el reset de la ventana
    const ttl = await redis.ttl(key);
    const remainingTtl = Math.max(ttl, 0);
    const resetAt = Math.floor(Date.now() / 1000) + remainingTtl;

    if (count > RATE_LIMIT) {
      return {
        allowed: false,
        limit: RATE_LIMIT,
        remaining: 0,
        resetAt,
        retryAfter: remainingTtl,
      };
    }

    return {
      allowed: true,
      limit: RATE_LIMIT,
      remaining: RATE_LIMIT - count,
      resetAt,
    };
  } catch {
    // RNF9: Fail-Closed — si Redis no responde, bloquear el acceso por defecto.
    // No se lanza la excepcion: el caller recibe un resultado bloqueado y actua
    // en consecuencia (503 SYSTEM_DEGRADED).
    return {
      allowed: false,
      limit: RATE_LIMIT,
      remaining: 0,
      resetAt: Math.floor(Date.now() / 1000) + WINDOW_SECONDS,
      retryAfter: WINDOW_SECONDS,
      failReason: 'CACHE_UNAVAILABLE',
    };
  } finally {
    // disconnect() es silencioso si la conexion nunca se establecio
    redis.disconnect();
  }
}
