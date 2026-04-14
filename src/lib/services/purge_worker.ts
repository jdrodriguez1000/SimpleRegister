/**
 * purge_worker.ts — Servicio de Bloqueo Distribuido para Purga de Usuarios
 * Trazabilidad: TSK-I2-B01-G3 — Purge Background Logic
 * Agente: backend-coder
 *
 * Responsabilidad única: adquirir y liberar un distributed lock via Redis
 * para garantizar que solo una instancia del Purge Worker ejecute la purga
 * física en un momento dado (prevención de doble-purga).
 *
 * Patrón implementado: Redis SET NX PX (atómico) — fail-safe ante caídas de Redis.
 *
 * Seguridad Fail-Closed (RNF9):
 *   - Si Redis no está disponible, acquirePurgeLock retorna false.
 *   - La purga no se ejecuta sin lock — garantía de idempotencia.
 *
 * Entorno de test (NODE_ENV=test):
 *   - Usa un Map en memoria para simular el comportamiento del lock sin Redis real.
 *   - Garantiza tests deterministas y aislados.
 */

import Redis from 'ioredis';

// =============================================================================
// Constantes de configuración
// =============================================================================

/** Valor almacenado como marcador del lock — identifica al propietario */
const LOCK_VALUE = 'purge_worker_lock';

// =============================================================================
// Implementación en memoria para entorno de test
// =============================================================================

/**
 * Mapa en memoria que simula el comportamiento del lock distribuido.
 * Solo activo cuando NODE_ENV=test — permite tests sin Redis real.
 */
const inMemoryLocks = new Map<string, NodeJS.Timeout | null>();

/**
 * Adquiere el lock en memoria (atómico en el runtime de Node.js single-threaded).
 * Retorna true si se adquirió, false si ya existía.
 */
function inMemoryAcquire(key: string, ttlMs: number): boolean {
  if (inMemoryLocks.has(key)) {
    return false;
  }
  // Programar liberación automática tras TTL (simula PX de Redis)
  const timeout = setTimeout(() => {
    inMemoryLocks.delete(key);
  }, ttlMs);
  inMemoryLocks.set(key, timeout);
  return true;
}

/**
 * Libera el lock en memoria y cancela el timeout de expiración.
 */
function inMemoryRelease(key: string): void {
  const timeout = inMemoryLocks.get(key);
  if (timeout !== undefined) {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    inMemoryLocks.delete(key);
  }
}

// =============================================================================
// Cliente Redis — conexión lazy (no conecta al importar el módulo)
// =============================================================================

let redisClient: Redis | null = null;

/**
 * Obtiene el cliente Redis singleton con conexión lazy.
 * Si REDIS_URL no está definida, retorna null.
 */
function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  redisClient = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    maxRetriesPerRequest: 0,
  });

  // Silenciar errores no manejados — fail-safe logging
  redisClient.on('error', () => {
    // Error de Redis — el caller manejará el false de acquirePurgeLock
  });

  return redisClient;
}

// =============================================================================
// API pública — Distributed Lock
// =============================================================================

/**
 * Intenta adquirir el distributed lock para la tarea de purga.
 *
 * En producción: usa Redis SET NX PX (operación atómica).
 * En test (NODE_ENV=test): usa Map en memoria para determinismo.
 * Fail-safe: retorna false si Redis no está disponible.
 *
 * @param key   - Clave identificadora del lock (ej: 'purge_worker:lock')
 * @param ttlMs - TTL del lock en milisegundos (recomendado: 600_000 para purga)
 * @returns true si el lock fue adquirido, false si ya existe o Redis no disponible
 */
export async function acquirePurgeLock(key: string, ttlMs: number): Promise<boolean> {
  // ---- Modo test: usar implementación en memoria ----
  if (process.env.NODE_ENV === 'test') {
    return inMemoryAcquire(key, ttlMs);
  }

  // ---- Modo producción: Redis distributed lock ----
  try {
    const client = getRedisClient();
    if (!client) {
      return false;
    }

    // SET key value NX PX ttlMs — atómico: solo escribe si no existe
    const result = await client.set(key, LOCK_VALUE, 'NX', 'PX', ttlMs);
    return result === 'OK';
  } catch {
    // Fail-safe: cualquier error de Redis retorna false
    return false;
  }
}

/**
 * Libera el distributed lock al finalizar la tarea de purga.
 * Debe llamarse en un bloque finally para garantizar la liberación.
 *
 * En producción: DEL key en Redis.
 * En test: elimina la entrada del Map en memoria.
 *
 * @param key - Clave del lock a liberar (debe coincidir con acquirePurgeLock)
 */
export async function releasePurgeLock(key: string): Promise<void> {
  // ---- Modo test: liberar en memoria ----
  if (process.env.NODE_ENV === 'test') {
    inMemoryRelease(key);
    return;
  }

  // ---- Modo producción: DEL en Redis ----
  try {
    const client = getRedisClient();
    if (!client) {
      return;
    }
    await client.del(key);
  } catch {
    // Silenciar error — el lock expirará automáticamente por TTL
  }
}

// =============================================================================
// Utilidad de inyección para testing avanzado
// =============================================================================

/**
 * Permite inyectar un cliente Redis mock en tests de integración.
 * No usar en producción.
 *
 * @param client - Cliente Redis mock o null para resetear
 */
export function _setRedisClientForTesting(client: Redis | null): void {
  redisClient = client;
}

/**
 * Limpia todos los locks en memoria entre tests.
 * Solo para uso en entorno de test (NODE_ENV=test).
 * Llamar en beforeEach/afterEach para garantizar aislamiento de estado.
 */
export function _resetLocksForTesting(): void {
  for (const timeout of inMemoryLocks.values()) {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  }
  inMemoryLocks.clear();
}
