/**
 * resend_rate_limiter.ts — Rate Limiter de reenvío (Fixed Window por hora por IP:Email)
 * Trazabilidad: TSK-I2-B03-G2
 * Agente: backend-coder
 *
 * Responsabilidad única: aplicar la política Fixed Window de 3 intentos/hr por
 * clave compuesta IP:Email para el endpoint POST /api/v1/auth/resend.
 *
 * Clave Redis: resend:ratelimit:{ip}:{normalizedEmail}:{YYYY-MM-DD-HH-UTC}
 * TTL dinámico: segundos hasta el inicio de la próxima hora UTC.
 *
 * Estrategia de fallback:
 *   - Si no se provee un store externo, usa un Map en memoria (útil para tests).
 *   - Si el store lanza excepción, el limiter devuelve
 *     { allowed: false, failReason: 'CACHE_UNAVAILABLE' } (RNF9 Fail-Closed).
 *
 * Clean Architecture: este módulo no sabe nada de HTTP ni de lógica de negocio
 * del reenvío. Solo responde a llamadas check(ip, email).
 */

// =============================================================================
// Contratos públicos (interfaces exportadas para inyección de dependencias)
// =============================================================================

export interface ResendRateLimitResult {
  /** true si la petición está dentro del límite */
  allowed: boolean;
  /** Peticiones restantes en la ventana actual */
  remaining: number;
  /** Unix Epoch (segundos) del próximo reset de ventana */
  reset: number;
  /** Segundos hasta el reset (solo cuando allowed=false) */
  retryAfter?: number;
  /** Razón de bloqueo por indisponibilidad del store */
  failReason?: 'CACHE_UNAVAILABLE';
}

export interface ResendRateLimiterStore {
  /** Incrementa el contador de la clave y devuelve el nuevo valor */
  increment(key: string, ttl: number): Promise<number>;
  /** Lee el contador actual de la clave (null si no existe) */
  get(key: string): Promise<number | null>;
}

// =============================================================================
// Constantes del dominio
// =============================================================================

/** Máximo de intentos de reenvío por IP:Email por hora */
const RESEND_LIMIT = 3;

// =============================================================================
// Store en memoria — fallback para entornos sin Redis (tests unitarios)
// =============================================================================

interface MemoryEntry {
  count: number;
  /** Unix epoch (ms) de expiración */
  expiresAt: number;
}

/**
 * Implementación in-memory del ResendRateLimiterStore.
 * Mantiene estado entre llamadas dentro del mismo proceso (test runner).
 */
class InMemoryStore implements ResendRateLimiterStore {
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
 * Obtiene la hora UTC actual como string YYYY-MM-DD-HH.
 * Sirve como sufijo de la clave para implementar la ventana horaria.
 */
function getUtcHourKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}`;
}

/**
 * Calcula cuántos segundos faltan hasta el inicio de la próxima hora UTC.
 * Este valor es el TTL dinámico de la clave en Redis/memoria.
 */
function secondsUntilNextHourUtc(): number {
  const now = new Date();
  const nextHour = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() + 1
    )
  );
  return Math.ceil((nextHour.getTime() - now.getTime()) / 1000);
}

/**
 * Obtiene el Unix Epoch (segundos) del próximo reset (inicio de la siguiente hora UTC).
 */
function nextHourUtcEpoch(): number {
  const now = new Date();
  const nextHour = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() + 1
    )
  );
  return Math.floor(nextHour.getTime() / 1000);
}

// =============================================================================
// Singleton de store en memoria — compartido entre todas las instancias del
// rate limiter que NO reciban un store externo. Necesario para que el estado
// persista entre múltiples llamadas a resendVerification en el mismo proceso.
//
// Se expone __resetResendInMemoryStore__ para que el entorno de tests pueda
// limpiar el estado entre bloques it() (test isolation). En producción nunca
// se llama a esta función.
// =============================================================================

const _defaultInMemoryStore = new InMemoryStore();

/**
 * Limpia el store in-memory compartido.
 * Uso EXCLUSIVO en entornos de test (beforeEach).
 * En producción este módulo nunca llama a esta función.
 */
export function __resetResendInMemoryStore__(): void {
  _defaultInMemoryStore.clear();
}

// =============================================================================
// Factory pública — createResendRateLimiter
// =============================================================================

/**
 * Crea una instancia del rate limiter de reenvío.
 *
 * @param store - Store de persistencia (Redis o in-memory). Si se omite, usa
 *                el singleton InMemoryStore compartido del proceso (tests).
 * @returns Objeto con el método check(ip, email) para evaluar la política.
 */
export function createResendRateLimiter(store?: ResendRateLimiterStore): {
  check(ip: string, email: string): Promise<ResendRateLimitResult>;
} {
  // Usar store inyectado o el singleton in-memory compartido
  const activeStore: ResendRateLimiterStore = store ?? _defaultInMemoryStore;

  return {
    async check(ip: string, email: string): Promise<ResendRateLimitResult> {
      const hourKey = getUtcHourKey();
      // Clave compuesta IP:Email para aislar contadores por combinación única
      const redisKey = `resend:ratelimit:${ip}:${email}:${hourKey}`;
      const ttl = secondsUntilNextHourUtc();
      const resetEpoch = nextHourUtcEpoch();

      try {
        const count = await activeStore.increment(redisKey, ttl);

        if (count > RESEND_LIMIT) {
          return {
            allowed: false,
            remaining: 0,
            reset: resetEpoch,
            retryAfter: ttl,
          };
        }

        return {
          allowed: true,
          remaining: RESEND_LIMIT - count,
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
