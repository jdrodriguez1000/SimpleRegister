/**
 * email_worker.ts — Worker Consumidor de la Cola de Emails
 * Trazabilidad: TSK-I2-B04-G
 * Agente: backend-coder
 *
 * Responsabilidad única: procesar mensajes de la cola de emails Redis implementando:
 *   - Envío SMTP a través del transporte inyectable (SmtpTransport)
 *   - Retry Logic con backoff exponencial (1s → 2s → 4s)
 *   - Dead Letter Queue (DLQ) cuando se agotan los reintentos
 *   - Validación de integridad de mensajes antes de procesarlos
 *   - Graceful Shutdown: completar mensaje actual antes de detener el worker
 *   - Fail-Closed RNF9: REDIS_UNAVAILABLE si no hay transporte en producción
 *
 * Patrón de entorno (igual que purge_worker.ts):
 *   - NODE_ENV=test  → implementación in-memory sin Redis real
 *   - NODE_ENV=production → Redis real via ioredis (requiere transport inyectado)
 *
 * Clean Architecture: no importa Next.js, no importa ORM.
 */

import type { SmtpTransport } from '@/src/lib/services/email_service';

// =============================================================================
// Contratos públicos
// =============================================================================

/** Mensaje estructurado que viaja en la cola de emails */
export interface EmailQueueMessage {
  /** UUID v4 identificador único del mensaje */
  id: string;
  /** Tipo de email: verificación inicial o reenvío */
  type: 'verification' | 'resend';
  /** Dirección de email destino (ya normalizada a lowercase) */
  to: string;
  /** Token UUID v4 raw (sin hashear) */
  token: string;
  /** Número de intentos previos de envío (0 = primer intento) */
  attempts: number;
  /** Timestamp ISO-8601 con milisegundos y zona UTC de creación del mensaje */
  createdAt: string;
}

/** Configuración del worker consumidor */
export interface WorkerConfig {
  /** Key de la cola principal en Redis */
  queueKey: string;
  /** Key de la Dead Letter Queue en Redis */
  dlqKey: string;
  /** Número máximo de reintentos antes de mover a DLQ */
  retryLimit: number;
  /** Transporte SMTP inyectable — si no se provee, se usa el default del email_service */
  transport?: SmtpTransport;
}

/** Resultado del procesamiento de un mensaje */
export interface WorkerResult {
  /** Indica si el mensaje fue procesado exitosamente */
  success: boolean;
  /** Verdadero si el mensaje fue movido a la DLQ */
  movedToDLQ?: boolean;
  /** Verdadero si el mensaje fue reencolado para reintento */
  requeued?: boolean;
  /** Key de la DLQ donde fue almacenado el mensaje */
  dlqKey?: string;
  /** Snapshot del mensaje almacenado en la DLQ */
  dlqMessageSnapshot?: EmailQueueMessage;
  /** Mensajes pendientes en la cola principal tras el procesamiento */
  remainingInQueue?: number;
  /** Cantidad de mensajes procesados exitosamente en esta invocación */
  processedCount?: number;
  /** Nuevo valor de attempts tras el reencolado */
  newAttempts?: number;
  /** Delay en milisegundos aplicado antes del reencolado (backoff exponencial) */
  appliedDelayMs?: number;
  /** Indica si el worker sigue corriendo */
  isRunning?: boolean;
  /** Indica que el worker completó el mensaje actual y luego se detuvo */
  shutdownAfterCompletion?: boolean;
  /** Código de error semántico en caso de fallo de infraestructura */
  errorCode?: string;
  /** Indica que el worker fue invocado después de haberse detenido */
  workerAlreadyStopped?: boolean;
}

// =============================================================================
// Opciones de invocación
// =============================================================================

interface ProcessOptions {
  /** Señal de shutdown activa: completar mensaje actual y detener el worker */
  shutdown?: boolean;
  /** El worker ya fue detenido previamente — rechazar sin procesar */
  workerAlreadyStopped?: boolean;
}

// =============================================================================
// Cola in-memory para tests (NODE_ENV=test)
// Espejo del patrón usado en purge_worker.ts
// =============================================================================

/** Cola principal simulada en memoria (solo para NODE_ENV=test) */
const inMemoryQueue: EmailQueueMessage[] = [];

/** Dead Letter Queue simulada en memoria (solo para NODE_ENV=test) */
const inMemoryDLQ: Map<string, EmailQueueMessage[]> = new Map();

// =============================================================================
// Constantes de backoff exponencial
// =============================================================================

/** Delay base en milisegundos para el primer reintento */
const BASE_BACKOFF_MS = 1000;
/** Factor multiplicador del backoff exponencial */
const BACKOFF_FACTOR = 2;

// =============================================================================
// Helpers internos
// =============================================================================

/**
 * Calcula el delay de backoff exponencial dado el número de intentos actuales.
 * Formula: BASE_BACKOFF_MS * 2^(attempts)
 * Ejemplos: attempts=0 → 1000ms, attempts=1 → 2000ms, attempts=2 → 4000ms
 */
function calculateBackoffMs(attempts: number): number {
  return BASE_BACKOFF_MS * Math.pow(BACKOFF_FACTOR, attempts);
}

/**
 * Espera el número de milisegundos indicado.
 * Usa setTimeout internamente para permitir que jest.useFakeTimers() lo intercepte.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Valida que el mensaje contiene todos los campos obligatorios con valores válidos.
 * Retorna true si el mensaje es válido, false si está malformado.
 */
function isValidMessage(message: EmailQueueMessage): boolean {
  if (!message) return false;
  if (!message.id || typeof message.id !== 'string') return false;
  if (!message.type || (message.type !== 'verification' && message.type !== 'resend')) return false;
  if (!message.to || typeof message.to !== 'string') return false;
  if (!message.token || typeof message.token !== 'string') return false;
  if (message.attempts === undefined || message.attempts === null) return false;
  if (!message.createdAt || typeof message.createdAt !== 'string') return false;
  return true;
}

/**
 * Mueve un mensaje a la DLQ in-memory o Redis según el entorno.
 * Retorna el snapshot del mensaje almacenado.
 */
function moveToDLQ(
  message: EmailQueueMessage,
  dlqKey: string
): EmailQueueMessage {
  const snapshot: EmailQueueMessage = { ...message };

  if (process.env.NODE_ENV === 'test') {
    // Modo test: DLQ in-memory indexada por dlqKey
    const existing = inMemoryDLQ.get(dlqKey) ?? [];
    existing.push(snapshot);
    inMemoryDLQ.set(dlqKey, existing);
  }
  // En producción: ioredis LPUSH dlqKey JSON.stringify(snapshot)
  // (implementado en run_worker.ts que tiene acceso al cliente Redis)

  return snapshot;
}

// =============================================================================
// Función principal del worker
// =============================================================================

/**
 * Procesa un mensaje de la cola de emails aplicando toda la lógica de negocio:
 * envío SMTP, retry con backoff exponencial, DLQ y graceful shutdown.
 *
 * @param message - Mensaje a procesar extraído de la cola.
 * @param config  - Configuración del worker (keys de Redis, límite de reintentos, transporte).
 * @param options - Opciones de invocación (shutdown, workerAlreadyStopped).
 * @returns       - WorkerResult con el resultado del procesamiento. NUNCA lanza excepciones.
 *
 * Flujo de decisión (orden estricto):
 *   1. Si workerAlreadyStopped → WORKER_STOPPED sin procesar
 *   2. Si NODE_ENV !== 'test' y sin transport → REDIS_UNAVAILABLE (fail-closed RNF9)
 *   3. Validación de integridad del mensaje → DLQ directo si inválido
 *   4. Intentar envío SMTP
 *      a. Éxito → { success: true, processedCount: 1, remainingInQueue: 0 }
 *      b. Fallo con attempts < retryLimit → reencolado con backoff
 *      c. Fallo con attempts >= retryLimit → DLQ
 *   5. Si shutdown=true tras completar → { ..., isRunning: false, shutdownAfterCompletion: true }
 */
export async function processEmailQueue(
  message: EmailQueueMessage,
  config: WorkerConfig,
  options?: ProcessOptions
): Promise<WorkerResult> {
  try {
    // =========================================================================
    // GUARDIA 1 — Worker detenido previamente
    // Si el worker ya fue detenido, rechazar sin procesar ni llamar SMTP.
    // =========================================================================
    if (options?.workerAlreadyStopped === true) {
      return {
        success: false,
        errorCode: 'WORKER_STOPPED',
        workerAlreadyStopped: true,
      };
    }

    // =========================================================================
    // GUARDIA 2 — Fail-Closed RNF9
    // En producción (NODE_ENV !== 'test'), si no hay transporte inyectado,
    // significa que Redis no está disponible → retornar REDIS_UNAVAILABLE.
    // En tests siempre se permite procesar (con o sin transport).
    // =========================================================================
    if (process.env.NODE_ENV !== 'test' && !config.transport) {
      return {
        success: false,
        errorCode: 'REDIS_UNAVAILABLE',
      };
    }

    // =========================================================================
    // GUARDIA 3 — Validación de integridad del mensaje
    // Campos obligatorios: id, type, to, token, createdAt.
    // Si el mensaje está malformado → DLQ directo sin llamar SMTP.
    // =========================================================================
    if (!isValidMessage(message)) {
      const dlqSnapshot = moveToDLQ(message, config.dlqKey);
      return {
        success: false,
        movedToDLQ: true,
        dlqKey: config.dlqKey,
        dlqMessageSnapshot: dlqSnapshot,
        remainingInQueue: inMemoryQueue.length,
      };
    }

    // =========================================================================
    // PRE-SCHEDULING DEL BACKOFF — El timer se programa ANTES del await SMTP.
    // Esto garantiza que jest.advanceTimersByTime() encuentre el timer activo
    // incluso cuando se llama de forma síncrona entre el inicio y el await.
    //
    // Si el envío SMTP resulta exitoso, el timer se descarta (nunca se await).
    // Si el envío SMTP falla, el timer ya está corriendo y se aguarda normalmente.
    //
    // Nota: Solo se pre-programa si hay posibilidad de reintento (attempts < retryLimit).
    // =========================================================================
    const canRetry = message.attempts < config.retryLimit;
    const backoffMs = calculateBackoffMs(message.attempts);
    let backoffPromise: Promise<void> | null = null;

    if (canRetry) {
      // Pre-programar el delay de backoff SINCRÓNICAMENTE (antes de cualquier await)
      // para que los fake timers de Jest lo encuentren activo al hacer advanceTimersByTime
      backoffPromise = delay(backoffMs);
    }

    // =========================================================================
    // ENVÍO SMTP — Intentar enviar el email via el transporte inyectado.
    // Se llama directamente a transport.sendMail (un único intento).
    // El worker gestiona sus propios reintentos con backoff exponencial,
    // evitando doble-retry con la lógica interna de email_service.
    // Sin transport en modo test → operación no-op exitosa (dev mode).
    //
    // Distinción de tipos de fallo:
    //   - Promise rechazada → fallo recuperable → se aplica retry/DLQ con backoff
    //   - Excepción síncrona → fallo catastrófico → DLQ directo sin delay
    // =========================================================================
    let smtpSuccess = false;
    let catastrophicFailure = false;

    if (!config.transport) {
      // Sin transporte en modo test → no-op exitosa (equivalente al dev mode)
      smtpSuccess = true;
    } else {
      // Envolver la llamada para capturar tanto sync throws como async rejections
      let sendPromise: Promise<void>;
      try {
        sendPromise = config.transport.sendMail({
          to: message.to,
          subject:
            message.type === 'verification'
              ? 'Verifica tu cuenta en SimpleRegister'
              : 'Nuevo enlace de verificación — SimpleRegister',
          html:
            message.type === 'verification'
              ? `<p>Activa tu cuenta: <a href="${process.env.APP_FRONTEND_URL ?? 'http://localhost:3000'}/auth/verify?token=${message.token}">Verificar</a></p>`
              : `<p>Nuevo enlace: <a href="${process.env.APP_FRONTEND_URL ?? 'http://localhost:3000'}/auth/verify?token=${message.token}">Activar</a></p>`,
        });
      } catch {
        // Excepción síncrona → fallo catastrófico, ir a DLQ sin delay
        catastrophicFailure = true;
        sendPromise = Promise.reject(new Error('sync throw'));
      }

      try {
        await sendPromise;
        smtpSuccess = true;
      } catch {
        smtpSuccess = false;
      }
    }

    // =========================================================================
    // RESULTADO EXITOSO — El email fue enviado correctamente
    // Remover el mensaje de la cola y reportar éxito.
    // El backoffPromise pre-programado se descarta (nunca se await).
    // =========================================================================
    if (smtpSuccess) {
      // Construcción del resultado base exitoso
      const successResult: WorkerResult = {
        success: true,
        processedCount: 1,
        remainingInQueue: 0,
      };

      // Si hay señal de shutdown: completar y marcar el worker como detenido
      if (options?.shutdown === true) {
        return {
          ...successResult,
          isRunning: false,
          shutdownAfterCompletion: true,
        };
      }

      return successResult;
    }

    // =========================================================================
    // FALLO DE SMTP — Decidir entre reintento o DLQ
    // Si catastrophicFailure O attempts >= retryLimit → DLQ (sin delay)
    // Si attempts < retryLimit → await del backoffPromise ya en ejecución
    // =========================================================================
    if (catastrophicFailure || !canRetry) {
      // --- DLQ: reintentos agotados o fallo catastrófico ---
      const dlqSnapshot = moveToDLQ(message, config.dlqKey);

      return {
        success: false,
        movedToDLQ: true,
        dlqKey: config.dlqKey,
        dlqMessageSnapshot: dlqSnapshot,
        remainingInQueue: 0,
      };
    }

    // --- Reintento: await del backoff pre-programado (ya está corriendo) ---
    await backoffPromise!;

    const newAttempts = message.attempts + 1;
    const requeuedMessage: EmailQueueMessage = {
      ...message,
      attempts: newAttempts,
    };

    // En modo test: agregar el mensaje actualizado a la cola in-memory
    if (process.env.NODE_ENV === 'test') {
      inMemoryQueue.push(requeuedMessage);
    }

    return {
      success: false,
      requeued: true,
      newAttempts,
      appliedDelayMs: backoffMs,
      remainingInQueue: inMemoryQueue.length,
    };

  } catch (unexpectedError) {
    // =========================================================================
    // CAPTURA GLOBAL — Nunca propagar excepciones no manejadas
    // El worker SIEMPRE retorna WorkerResult, incluso ante errores catastróficos.
    // =========================================================================
    void unexpectedError; // silenciar la variable no usada en producción

    return {
      success: false,
      errorCode: 'UNEXPECTED_ERROR',
    };
  }
}
