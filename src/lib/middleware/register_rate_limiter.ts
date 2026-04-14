/**
 * register_rate_limiter.ts — Rate Limiter de registro (Fixed Window diario por IP)
 * Trazabilidad: TSK-I2-B02-G3 + TSK-I2-B02-RF
 * Agente: backend-coder
 *
 * Responsabilidad única: aplicar la política Fixed Window de 5 intentos/día/IP
 * para el endpoint POST /api/v1/auth/register.
 *
 * Clave Redis: register:ratelimit:{ip}:{YYYY-MM-DD-UTC}
 * TTL dinámico: segundos hasta las 00:00:00 UTC del día siguiente.
 *
 * Estrategia de fallback:
 *   - Si no se provee un store externo, usa un Map en memoria (útil para tests).
 *   - Si el flag simulateRedisFailure está activo, el store lanza excepción
 *     y el limiter devuelve { allowed: false, failReason: 'CACHE_UNAVAILABLE' }.
 *
 * Clean Architecture: este módulo no sabe nada de HTTP ni de lógica de negocio
 * del registro. Solo responde a llamadas check(ip).
 */

// =============================================================================
// Contratos públicos (interfaces exportadas para inyección de dependencias)
// =============================================================================

export interface RateLimitResult {
  /** true si la petición está dentro del límite */
  allowed: boolean;
  /** Peticiones restantes en la ventana actual */
  remaining: number;
  /** Unix Epoch (segundos) del próximo reset de ventana */
  reset: number;
  /** Segundos hasta el reset (sólo cuando allowed=false) */
  retryAfter?: number;
  /** Razón de bloqueo por indisponibilidad del store */
  failReason?: 'CACHE_UNAVAILABLE';
}

export interface RateLimiterStore {
  /** Incrementa el contador de la clave y devuelve el nuevo valor */
  increment(key: string, ttl: number): Promise<number>;
  /** Lee el contador actual de la clave (null si no existe) */
  get(key: string): Promise<number | null>;
}

// =============================================================================
// Constantes del dominio
// =============================================================================

/** Máximo de intentos de registro por IP por día */
const REGISTER_LIMIT = 5;

// =============================================================================
// Store en memoria — fallback para entornos sin Redis (tests unitarios)
// =============================================================================

interface MemoryEntry {
  count: number;
  /** Unix epoch (ms) de expiración */
  expiresAt: number;
}

/**
 * Implementación in-memory del RateLimiterStore.
 * Mantiene estado entre llamadas dentro del mismo proceso (test runner).
 */
class InMemoryStore implements RateLimiterStore {
  private readonly store: Map<string, MemoryEntry> = new Map();

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const now = Date.now();
    const entry = this.store.get(key);

    // Si la clave no existe o expiró, crear nueva entrada
    if (!entry || entry.expiresAt <= now) {
      const newEntry: MemoryEntry = {
        count: 1,
        expiresAt: now + ttlSeconds * 1000,
      };
      this.store.set(key, newEntry);
      return 1;
    }

    entry.count += 1;
    return entry.count;
  }

  async get(key: string): Promise<number | null> {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= now) return null;
    return entry.count;
  }

  /** Vacía el store — usado para aislar tests entre sí */
  clear(): void {
    this.store.clear();
  }
}

// =============================================================================
// Utilidades de tiempo
// =============================================================================

/**
 * Obtiene la fecha UTC actual como string YYYY-MM-DD.
 * Sirve como sufijo de la clave para implementar la ventana diaria.
 */
function getUtcDateKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calcula cuántos segundos faltan hasta las 00:00:00 UTC del día siguiente.
 * Este valor es el TTL dinámico de la clave en Redis/memoria.
 */
function secondsUntilMidnightUtc(): number {
  const now = new Date();
  // Construir el inicio del día siguiente en UTC
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);
}

/**
 * Obtiene el Unix Epoch (segundos) del próximo reset (00:00:00 UTC del día siguiente).
 */
function nextMidnightUtcEpoch(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return Math.floor(tomorrow.getTime() / 1000);
}

// =============================================================================
// Singleton de store en memoria — compartido entre todas las instancias del
// rate limiter que NO reciban un store externo. Necesario para que el estado
// persista entre múltiples llamadas a registerUser en el mismo proceso (tests).
//
// Se expone __resetInMemoryStore__ para que el entorno de tests pueda limpiar
// el estado entre bloques it() (test isolation). En producción nunca se llama.
// =============================================================================

const _defaultInMemoryStore = new InMemoryStore();

/**
 * Limpia el store in-memory compartido.
 * Uso EXCLUSIVO en entornos de test (beforeEach).
 * En producción este módulo nunca llama a esta función.
 */
export function __resetInMemoryStore__(): void {
  _defaultInMemoryStore.clear();
}

// =============================================================================
// Factory pública — createRegisterRateLimiter
// =============================================================================

/**
 * Crea una instancia del rate limiter de registro.
 *
 * @param store - Store de persistencia (Redis o in-memory). Si se omite, usa
 *                el singleton InMemoryStore compartido del proceso (tests).
 * @returns Objeto con el método check(ip) para evaluar la política.
 */
export function createRegisterRateLimiter(store?: RateLimiterStore): {
  check(ip: string): Promise<RateLimitResult>;
} {
  // Usar store inyectado o el singleton in-memory compartido
  const activeStore: RateLimiterStore = store ?? _defaultInMemoryStore;

  return {
    async check(ip: string): Promise<RateLimitResult> {
      const dateKey = getUtcDateKey();
      const redisKey = `register:ratelimit:${ip}:${dateKey}`;
      const ttl = secondsUntilMidnightUtc();
      const resetEpoch = nextMidnightUtcEpoch();

      try {
        const count = await activeStore.increment(redisKey, ttl);

        if (count > REGISTER_LIMIT) {
          return {
            allowed: false,
            remaining: 0,
            reset: resetEpoch,
            retryAfter: ttl,
          };
        }

        return {
          allowed: true,
          remaining: REGISTER_LIMIT - count,
          reset: resetEpoch,
        };
      } catch {
        // RNF9: Fail-Closed — si el store falla, bloquear
        return {
          allowed: false,
          remaining: 0,
          reset: resetEpoch,
          retryAfter: ttl,
          failReason: 'CACHE_UNAVAILABLE',
        };
      }
    },
  };
}
