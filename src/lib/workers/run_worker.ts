/**
 * run_worker.ts — Punto de Entrada del Worker de Emails como Proceso Independiente
 * Trazabilidad: TSK-I2-B04-RF
 * Agente: backend-coder
 *
 * Responsabilidad única: arrancar el worker consumidor de la cola de emails Redis
 * como proceso Node.js independiente (fuera del ciclo de vida de Next.js).
 *
 * Patrón de consumo: BRPOP (blocking right-pop) sobre la cola principal.
 * Permite al proceso dormir eficientemente en Redis hasta que llegue un mensaje.
 *
 * Graceful Shutdown:
 *   - Escucha SIGTERM (Docker stop / Kubernetes pod eviction)
 *   - Completa el mensaje en vuelo antes de terminar
 *   - No acepta nuevos mensajes tras la señal
 *
 * Logging: console.log (estructurado, sin Pino — Pino no disponible en este módulo)
 *
 * Clean Architecture: no importa Next.js, no importa ORM.
 */

import Redis from 'ioredis';
import {
  processEmailQueue,
  type EmailQueueMessage,
  type WorkerConfig,
} from './email_worker';

// =============================================================================
// Configuración del worker desde variables de entorno
// =============================================================================

const QUEUE_KEY = process.env.EMAIL_QUEUE_KEY ?? 'email:queue';
const DLQ_KEY = process.env.EMAIL_DLQ_KEY ?? 'email:dlq';
const RETRY_LIMIT = parseInt(process.env.EMAIL_RETRY_LIMIT ?? '3', 10);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';
/** Timeout de BRPOP en segundos (0 = espera indefinida) */
const BRPOP_TIMEOUT_SECONDS = 5;

// =============================================================================
// Estado del worker
// =============================================================================

/** Indica si el worker está en proceso de shutdown */
let isShuttingDown = false;
/** Indica si el worker ya completó su ciclo de shutdown */
let workerStopped = false;

// =============================================================================
// Inicialización del cliente Redis
// =============================================================================

const redisClient = new Redis(REDIS_URL, {
  // Reintentos de reconexión con backoff (RNF9 — Fail-Closed)
  retryStrategy: (times: number) => {
    if (times > 5) {
      // Después de 5 reintentos, detener el worker
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'REDIS_RECONNECT_EXHAUSTED',
          message: 'No se pudo reconectar a Redis tras 5 intentos. Deteniendo worker.',
          attempts: times,
          timestamp: new Date().toISOString(),
        })
      );
      process.exit(1);
    }
    // Backoff exponencial: 500ms → 1s → 2s → 4s → 8s
    return Math.min(times * 500, 8000);
  },
  enableOfflineQueue: false,
  lazyConnect: false,
});

redisClient.on('connect', () => {
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'REDIS_CONNECTED',
      message: 'Worker conectado a Redis correctamente.',
      queueKey: QUEUE_KEY,
      dlqKey: DLQ_KEY,
      retryLimit: RETRY_LIMIT,
      timestamp: new Date().toISOString(),
    })
  );
});

redisClient.on('error', (err: Error) => {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'REDIS_ERROR',
      message: err.message,
      timestamp: new Date().toISOString(),
    })
  );
});

// =============================================================================
// Configuración del worker
// =============================================================================

const workerConfig: WorkerConfig = {
  queueKey: QUEUE_KEY,
  dlqKey: DLQ_KEY,
  retryLimit: RETRY_LIMIT,
  // transport: se inyecta en producción si SMTP está configurado
  // Por defecto undefined → email_service usará el no-op de desarrollo
};

// =============================================================================
// Loop principal de consumo (BRPOP pattern)
// =============================================================================

/**
 * Mueve un mensaje a la DLQ en Redis usando LPUSH.
 * Se invoca cuando el worker detecta agotamiento de reintentos.
 */
async function pushToDLQ(message: EmailQueueMessage): Promise<void> {
  try {
    await redisClient.lpush(DLQ_KEY, JSON.stringify(message));
    console.log(
      JSON.stringify({
        level: 'audit',
        event: 'MESSAGE_MOVED_TO_DLQ',
        messageId: message.id,
        attempts: message.attempts,
        dlqKey: DLQ_KEY,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'DLQ_PUSH_FAILED',
        messageId: message.id,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      })
    );
  }
}

/**
 * Procesa un único mensaje de la cola.
 * Orquesta processEmailQueue y gestiona el resultado (reencolar en Redis, DLQ, etc.).
 */
async function handleMessage(message: EmailQueueMessage): Promise<void> {
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'MESSAGE_PROCESSING',
      messageId: message.id,
      type: message.type,
      attempts: message.attempts,
      timestamp: new Date().toISOString(),
    })
  );

  const result = await processEmailQueue(message, workerConfig, {
    shutdown: isShuttingDown,
  });

  if (result.success) {
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'MESSAGE_SENT',
        messageId: message.id,
        type: message.type,
        timestamp: new Date().toISOString(),
      })
    );
  } else if (result.requeued) {
    // Reencolado: LPUSH para mantener FIFO (consumer usa BRPOP desde el extremo opuesto)
    const requeuedMessage: EmailQueueMessage = {
      ...message,
      attempts: result.newAttempts ?? message.attempts + 1,
    };
    await redisClient.rpush(QUEUE_KEY, JSON.stringify(requeuedMessage));
    console.log(
      JSON.stringify({
        level: 'warning',
        event: 'MESSAGE_REQUEUED',
        messageId: message.id,
        newAttempts: result.newAttempts,
        appliedDelayMs: result.appliedDelayMs,
        timestamp: new Date().toISOString(),
      })
    );
  } else if (result.movedToDLQ) {
    // DLQ: persistir en Redis (el processEmailQueue en-memoria ya lo hizo en test)
    await pushToDLQ(result.dlqMessageSnapshot ?? message);
  } else if (result.errorCode) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'MESSAGE_ERROR',
        messageId: message.id,
        errorCode: result.errorCode,
        timestamp: new Date().toISOString(),
      })
    );
  }

  // Marcar como detenido si el shutdown se completó
  if (result.shutdownAfterCompletion) {
    workerStopped = true;
  }
}

/**
 * Loop principal del worker.
 * Usa BRPOP con timeout para poder verificar la señal de shutdown periódicamente.
 */
async function runWorkerLoop(): Promise<void> {
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'WORKER_STARTED',
      message: 'Worker de emails iniciado. Esperando mensajes...',
      queueKey: QUEUE_KEY,
      timestamp: new Date().toISOString(),
    })
  );

  while (!workerStopped) {
    try {
      // BRPOP: bloquea hasta recibir un mensaje o que expire el timeout
      const response = await redisClient.brpop(QUEUE_KEY, BRPOP_TIMEOUT_SECONDS);

      if (!response) {
        // Timeout sin mensaje: verificar si hay señal de shutdown
        if (isShuttingDown) {
          console.log(
            JSON.stringify({
              level: 'info',
              event: 'WORKER_SHUTDOWN_IDLE',
              message: 'Shutdown recibido mientras el worker estaba inactivo. Deteniendo.',
              timestamp: new Date().toISOString(),
            })
          );
          break;
        }
        continue;
      }

      // response es [queueKey, messageJson]
      const [, messageJson] = response;

      let message: EmailQueueMessage;
      try {
        message = JSON.parse(messageJson) as EmailQueueMessage;
      } catch {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'MESSAGE_PARSE_ERROR',
            message: 'No se pudo parsear el mensaje de la cola.',
            raw: messageJson,
            timestamp: new Date().toISOString(),
          })
        );
        continue;
      }

      await handleMessage(message);

    } catch (err) {
      // Error de conexión Redis: esperar brevemente y reintentar
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'WORKER_LOOP_ERROR',
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        })
      );

      if (!isShuttingDown) {
        // Esperar 2s antes de reintentar para no saturar en caso de error persistente
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'WORKER_STOPPED',
      message: 'Worker de emails detenido correctamente.',
      timestamp: new Date().toISOString(),
    })
  );

  await redisClient.quit();
  process.exit(0);
}

// =============================================================================
// Gestión de señales del sistema (Graceful Shutdown)
// =============================================================================

/**
 * Maneja la señal SIGTERM enviada por Docker/Kubernetes al detener el contenedor.
 * Completa el mensaje en vuelo y luego termina el proceso.
 */
process.on('SIGTERM', () => {
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'SIGTERM_RECEIVED',
      message: 'Señal SIGTERM recibida. Completando mensaje actual y deteniendo worker...',
      timestamp: new Date().toISOString(),
    })
  );
  isShuttingDown = true;
});

process.on('SIGINT', () => {
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'SIGINT_RECEIVED',
      message: 'Señal SIGINT recibida. Deteniendo worker...',
      timestamp: new Date().toISOString(),
    })
  );
  isShuttingDown = true;
});

// =============================================================================
// Arranque del worker
// =============================================================================

runWorkerLoop().catch((err: unknown) => {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'WORKER_FATAL',
      message: 'Error fatal en el worker de emails. Terminando proceso.',
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    })
  );
  process.exit(1);
});
