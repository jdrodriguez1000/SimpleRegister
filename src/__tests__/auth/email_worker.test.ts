/**
 * TSK-I2-B04-R — email_worker.test.ts
 * Agente: backend-tester
 * Estado: RED — El módulo email_worker NO EXISTE en src/lib/workers/email_worker.ts.
 *         TODOS estos tests deben FALLAR con "Cannot find module" hasta que
 *         TSK-I2-B04-G implemente el worker consumidor de la cola de emails.
 *
 * Suite de tests de integración que validan el contrato completo del worker
 * consumidor de la cola de emails Redis (patrón BRPOP/BLPOP).
 *
 * Grupos:
 *   1. Happy Path — Procesamiento Exitoso (4 tests)
 *   2. Retry Logic — Reintentos con Backoff Exponencial (5 tests)
 *   3. Dead Letter Queue (DLQ) — Agotamiento de Reintentos (4 tests)
 *   4. Resiliencia Redis — Fail-Closed RNF9 (3 tests)
 *   5. Graceful Shutdown — SIGTERM (3 tests)
 *
 * Trazabilidad: PROJECT_spec.md §Iteración 2 — Email Queue Worker
 * Protocolos: tdd-master (RED-CHECK), api-contract-tester (Strict No-Excess)
 *
 * Política de entorno: NODE_ENV=test — se usa implementación in-memory sin Redis real.
 * Referencia de patrón: src/lib/services/purge_worker.ts (in-memory fallback para tests)
 */

// =============================================================================
// ATENCIÓN: Este import FALLARÁ hasta que TSK-I2-B04-G implemente el módulo.
// El fallo deliberado con "Cannot find module" ES el estado RED requerido.
// =============================================================================

import {
  processEmailQueue,
  type EmailQueueMessage,
  type WorkerConfig,
  type WorkerResult,
} from '@/src/lib/workers/email_worker';

// Importamos los tipos del servicio de email para tipar el mock correctamente
import type { SmtpTransport, EmailResult } from '@/src/lib/services/email_service';

// =============================================================================
// Helpers de validación de contratos (api-contract-tester §II)
// =============================================================================

/** Regex UUID v4 estricto */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Regex timestamp ISO-8601 con milisegundos y zona UTC */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// =============================================================================
// Fixtures — datos de prueba coherentes (Regla: Mocks Realistas)
// =============================================================================

/** Mensaje de tipo verification bien formado para pruebas */
const VALID_VERIFICATION_MESSAGE: EmailQueueMessage = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  type: 'verification',
  to: 'user@example.com',
  token: 'f1e2d3c4-b5a6-4f7e-8d9c-0b1a2f3e4d5c',
  attempts: 0,
  createdAt: '2026-04-14T10:00:00.000Z',
};

/** Mensaje de tipo resend bien formado para pruebas */
const VALID_RESEND_MESSAGE: EmailQueueMessage = {
  id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  type: 'resend',
  to: 'other@example.com',
  token: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
  attempts: 0,
  createdAt: '2026-04-14T10:05:00.000Z',
};

/** Configuración base del worker para tests */
const BASE_WORKER_CONFIG: WorkerConfig = {
  queueKey: 'test:email:queue',
  dlqKey: 'test:email:dlq',
  retryLimit: 3,
};

// =============================================================================
// Factory de transporte SMTP mock
// =============================================================================

/**
 * Crea un stub de SmtpTransport que siempre resuelve con éxito.
 * Permite espiar la cantidad de llamadas a sendMail.
 */
function createSuccessTransport(): jest.Mocked<SmtpTransport> {
  return {
    sendMail: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Crea un stub de SmtpTransport que siempre falla con un error SMTP.
 */
function createFailingTransport(): jest.Mocked<SmtpTransport> {
  return {
    sendMail: jest.fn().mockRejectedValue(new Error('SMTP connection refused')),
  };
}

// =============================================================================
// Configuración global de tests
// =============================================================================

beforeEach(() => {
  // Asegurar entorno de test — el worker usa implementación in-memory
  process.env.NODE_ENV = 'test';
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

// =============================================================================
// Grupo 1 — Happy Path: Procesamiento Exitoso
// =============================================================================

describe('Grupo 1 — Worker: Procesamiento Exitoso (Happy Path)', () => {
  /**
   * Verifica que un mensaje de tipo verification se procese correctamente
   * y que el resultado indique éxito sin mover el mensaje a DLQ.
   */
  it('debe procesar un mensaje tipo verification y retornar { success: true }', async () => {
    const transport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const result: WorkerResult = await processEmailQueue(
      VALID_VERIFICATION_MESSAGE,
      config
    );

    expect(result.success).toBe(true);
    expect(result.movedToDLQ).toBeFalsy();
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifica que un mensaje de tipo resend se procese correctamente
   * y que el resultado indique éxito.
   */
  it('debe procesar un mensaje tipo resend y retornar { success: true }', async () => {
    const transport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const result: WorkerResult = await processEmailQueue(
      VALID_RESEND_MESSAGE,
      config
    );

    expect(result.success).toBe(true);
    expect(result.movedToDLQ).toBeFalsy();
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifica que el resultado incluya el contador de mensajes procesados
   * correctamente tras un envío exitoso.
   */
  it('debe incrementar el contador de mensajes procesados correctamente', async () => {
    const transport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const result: WorkerResult = await processEmailQueue(
      VALID_VERIFICATION_MESSAGE,
      config
    );

    // El resultado debe reportar que exactamente 1 mensaje fue procesado
    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(1);
  });

  /**
   * Verifica que tras un procesamiento exitoso el mensaje haya sido removido
   * de la cola principal (no debe existir en la in-memory queue).
   */
  it('debe remover el mensaje de la cola tras procesamiento exitoso', async () => {
    const transport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const result: WorkerResult = await processEmailQueue(
      VALID_VERIFICATION_MESSAGE,
      config
    );

    expect(result.success).toBe(true);
    // El mensaje procesado no debe estar pendiente en cola
    expect(result.remainingInQueue).toBe(0);
  });
});

// =============================================================================
// Grupo 2 — Retry Logic: Reintentos con Backoff Exponencial
// =============================================================================

describe('Grupo 2 — Worker: Retry Logic (Reintentos)', () => {
  /**
   * Verifica que si el SMTP falla y attempts < retryLimit,
   * el mensaje es reencolado con attempts incrementado en 1.
   */
  it('debe reencolar el mensaje con attempts+1 si SMTP falla y attempts < retryLimit', async () => {
    const transport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const messageWithAttempts: EmailQueueMessage = {
      ...VALID_VERIFICATION_MESSAGE,
      attempts: 0,
    };

    // Avanzar timers para saltar el delay de backoff (1s base)
    const resultPromise = processEmailQueue(messageWithAttempts, config);
    jest.runAllTimersAsync();
    const result: WorkerResult = await resultPromise;

    // Con attempts=0 y retryLimit=3, debe reencolarse
    expect(result.success).toBe(false);
    expect(result.movedToDLQ).toBeFalsy();
    expect(result.requeued).toBe(true);
    expect(result.newAttempts).toBe(1);
  });

  /**
   * Verifica que si el SMTP falla y attempts >= retryLimit,
   * el mensaje NO se reencola — va directo a DLQ.
   */
  it('debe no reencolar el mensaje si SMTP falla y attempts >= retryLimit', async () => {
    const transport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const messageAtLimit: EmailQueueMessage = {
      ...VALID_VERIFICATION_MESSAGE,
      attempts: 3, // ya en el límite
    };

    const result: WorkerResult = await processEmailQueue(messageAtLimit, config);

    expect(result.success).toBe(false);
    expect(result.requeued).toBeFalsy();
    expect(result.movedToDLQ).toBe(true);
  });

  /**
   * Verifica que el delay entre reintentos sigue el patrón de backoff
   * exponencial: 1s -> 2s -> 4s (base 1000ms, factor 2x).
   * Se usa jest.useFakeTimers() para interceptar los setTimeout/delay.
   */
  it('debe aplicar backoff exponencial entre reintentos (1s → 2s → 4s)', async () => {
    const transport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const messageFirstAttempt: EmailQueueMessage = {
      ...VALID_VERIFICATION_MESSAGE,
      attempts: 0,
    };

    // El worker debe programar un delay antes de reencolado
    // Con fake timers verificamos que el delay programado es 1000ms (primer reintento)
    const resultPromise = processEmailQueue(messageFirstAttempt, config);

    // Avanzar exactamente 1000ms para el primer backoff
    jest.advanceTimersByTime(1000);
    const result: WorkerResult = await resultPromise;

    // Verificar que el delay correcto fue aplicado (1s para el primer reintento)
    expect(result.appliedDelayMs).toBe(1000);
  });

  /**
   * Verifica que un mensaje con attempts=2 y retryLimit=3 se reencola
   * una vez más (tiene 1 intento restante) antes de ir a DLQ.
   */
  it('debe reencolar cuando attempts:2 retryLimit:3 (queda 1 intento restante)', async () => {
    const transport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, retryLimit: 3, transport };

    const messageNearLimit: EmailQueueMessage = {
      ...VALID_VERIFICATION_MESSAGE,
      attempts: 2,
    };

    const resultPromise = processEmailQueue(messageNearLimit, config);
    jest.runAllTimersAsync();
    const result: WorkerResult = await resultPromise;

    // attempts=2 < retryLimit=3 → debe reencolarse con attempts=3
    expect(result.requeued).toBe(true);
    expect(result.newAttempts).toBe(3);
    expect(result.movedToDLQ).toBeFalsy();
  });

  /**
   * Verifica que un mensaje con attempts=3 y retryLimit=3 va directamente
   * a DLQ sin pasar por la cola principal.
   */
  it('debe enviar a DLQ directamente cuando attempts:3 retryLimit:3 (límite exacto)', async () => {
    const transport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, retryLimit: 3, transport };

    const messageAtExactLimit: EmailQueueMessage = {
      ...VALID_VERIFICATION_MESSAGE,
      attempts: 3,
    };

    const result: WorkerResult = await processEmailQueue(messageAtExactLimit, config);

    // attempts=3 >= retryLimit=3 → DLQ directo, no reencolar
    expect(result.movedToDLQ).toBe(true);
    expect(result.requeued).toBeFalsy();
  });
});

// =============================================================================
// Grupo 3 — Dead Letter Queue (DLQ)
// =============================================================================

describe('Grupo 3 — Dead Letter Queue (DLQ)', () => {
  /**
   * Verifica que cuando un mensaje agota todos sus reintentos,
   * es movido a la dlqKey configurada.
   */
  it('debe mover el mensaje a dlqKey cuando agota reintentos', async () => {
    const transport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const exhaustedMessage: EmailQueueMessage = {
      ...VALID_VERIFICATION_MESSAGE,
      attempts: 3, // ya en el límite máximo
    };

    const result: WorkerResult = await processEmailQueue(exhaustedMessage, config);

    expect(result.movedToDLQ).toBe(true);
    expect(result.dlqKey).toBe(BASE_WORKER_CONFIG.dlqKey);
  });

  /**
   * Verifica que el mensaje almacenado en DLQ conserva el estado final,
   * con attempts igual a retryLimit (evidencia forense del agotamiento).
   */
  it('debe conservar attempts=retryLimit en el mensaje almacenado en DLQ', async () => {
    const transport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const exhaustedMessage: EmailQueueMessage = {
      ...VALID_VERIFICATION_MESSAGE,
      attempts: 3,
    };

    const result: WorkerResult = await processEmailQueue(exhaustedMessage, config);

    expect(result.movedToDLQ).toBe(true);
    // El snapshot del mensaje en DLQ debe reflejar attempts en el límite
    expect(result.dlqMessageSnapshot?.attempts).toBe(3);
  });

  /**
   * Verifica que tras mover a DLQ, la cola principal no contiene el mensaje.
   * Garantía de que el mensaje no queda en cola principal y en DLQ a la vez.
   */
  it('debe asegurar que la cola principal no contiene el mensaje tras DLQ', async () => {
    const transport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const exhaustedMessage: EmailQueueMessage = {
      ...VALID_VERIFICATION_MESSAGE,
      attempts: 3,
    };

    const result: WorkerResult = await processEmailQueue(exhaustedMessage, config);

    expect(result.movedToDLQ).toBe(true);
    // La cola principal debe quedar vacía — 0 mensajes pendientes
    expect(result.remainingInQueue).toBe(0);
  });

  /**
   * Verifica que el WorkerResult retorna { success: false, movedToDLQ: true }
   * cuando un mensaje agota todos sus reintentos.
   */
  it('debe retornar { success: false, movedToDLQ: true } cuando agota reintentos', async () => {
    const transport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const exhaustedMessage: EmailQueueMessage = {
      ...VALID_VERIFICATION_MESSAGE,
      attempts: 3,
    };

    const result: WorkerResult = await processEmailQueue(exhaustedMessage, config);

    // Contrato exacto de WorkerResult para mensajes agotados (api-contract-tester)
    expect(result.success).toBe(false);
    expect(result.movedToDLQ).toBe(true);
    // No deben existir campos extra no documentados
    expect(result.errorCode).toBeUndefined();
  });
});

// =============================================================================
// Grupo 4 — Resiliencia Redis: Fail-Closed RNF9
// =============================================================================

describe('Grupo 4 — Worker: Resiliencia Redis (Fail-Closed RNF9)', () => {
  /**
   * Verifica que si Redis no está disponible, el worker retorna
   * { success: false, errorCode: 'REDIS_UNAVAILABLE' } sin lanzar excepción.
   * Implementa RNF9: Seguridad Fail-Closed.
   */
  it('debe retornar REDIS_UNAVAILABLE si Redis no está disponible', async () => {
    // Forzar modo Redis real (no test) y simular conexión fallida
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Config sin transport — worker intentará usar Redis real (no disponible)
    const config: WorkerConfig = {
      ...BASE_WORKER_CONFIG,
      // Sin transporte inyectado — el worker intentará Redis real
    };

    const result: WorkerResult = await processEmailQueue(
      VALID_VERIFICATION_MESSAGE,
      config
    );

    process.env.NODE_ENV = originalEnv;

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('REDIS_UNAVAILABLE');
  });

  /**
   * Verifica que el worker nunca lanza excepciones no manejadas.
   * Siempre debe retornar un WorkerResult, incluso ante errores graves.
   */
  it('no debe lanzar excepciones no manejadas — siempre retorna WorkerResult', async () => {
    const transport: SmtpTransport = {
      // Simular un error catastrófico que lanza en lugar de rechazar
      sendMail: () => { throw new Error('Catastrophic SMTP failure'); },
    };

    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    // El worker NUNCA debe propagar la excepción — debe capturarla y retornar WorkerResult
    await expect(
      processEmailQueue(VALID_VERIFICATION_MESSAGE, config)
    ).resolves.toBeDefined();

    const result: WorkerResult = await processEmailQueue(
      VALID_VERIFICATION_MESSAGE,
      config
    );
    expect(result.success).toBe(false);
  });

  /**
   * Verifica que mensajes con campos obligatorios faltantes o formato inválido
   * son enviados directamente a DLQ sin intentar el envío SMTP.
   * Previene corrupción de datos en la cola.
   */
  it('debe enviar a DLQ directamente mensajes con formato inválido (campos faltantes)', async () => {
    const transport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    // Mensaje malformado — falta campo 'token' obligatorio
    const malformedMessage = {
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      type: 'verification' as const,
      to: 'user@example.com',
      // token: FALTANTE — campo obligatorio ausente
      attempts: 0,
      createdAt: '2026-04-14T10:00:00.000Z',
    } as unknown as EmailQueueMessage;

    const result: WorkerResult = await processEmailQueue(malformedMessage, config);

    // El SMTP no debe haber sido invocado — mensaje va directo a DLQ
    expect(transport.sendMail).not.toHaveBeenCalled();
    expect(result.movedToDLQ).toBe(true);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Grupo 5 — Graceful Shutdown: SIGTERM
// =============================================================================

describe('Grupo 5 — Graceful Shutdown (SIGTERM)', () => {
  /**
   * Verifica que el worker completa el procesamiento del mensaje actual
   * antes de detenerse cuando recibe la señal de shutdown.
   * Garantía de no pérdida de mensajes en vuelo.
   */
  it('debe completar el mensaje actual antes de detenerse tras señal de shutdown', async () => {
    const transport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    // El procesamiento del mensaje actual debe completarse
    const result: WorkerResult = await processEmailQueue(
      VALID_VERIFICATION_MESSAGE,
      config,
      { shutdown: true } // señal de shutdown activa durante el procesamiento
    );

    // El mensaje en vuelo debe completarse exitosamente
    expect(result.success).toBe(true);
    // El worker debe indicar que se detuvo tras completar
    expect(result.shutdownAfterCompletion).toBe(true);
  });

  /**
   * Verifica que tras recibir la señal de shutdown, el estado interno
   * isRunning del worker cambia a false.
   */
  it('debe marcar isRunning=false tras recibir señal de shutdown', async () => {
    const transport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    const result: WorkerResult = await processEmailQueue(
      VALID_VERIFICATION_MESSAGE,
      config,
      { shutdown: true }
    );

    // El resultado debe reportar que el worker ya no está corriendo
    expect(result.isRunning).toBe(false);
  });

  /**
   * Verifica que el worker no acepta ni procesa nuevos mensajes
   * después de haber recibido la señal de shutdown.
   * Previene procesamiento fantasma post-shutdown.
   */
  it('debe rechazar nuevos mensajes sin procesarlos tras recibir señal de shutdown', async () => {
    const transport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_WORKER_CONFIG, transport };

    // Primer mensaje inicia el shutdown
    await processEmailQueue(
      VALID_VERIFICATION_MESSAGE,
      config,
      { shutdown: true }
    );

    // Segundo mensaje después del shutdown — no debe procesarse
    const postShutdownResult: WorkerResult = await processEmailQueue(
      VALID_RESEND_MESSAGE,
      config,
      { workerAlreadyStopped: true }
    );

    // El transporte NO debe haber sido llamado para el mensaje post-shutdown
    // (solo 1 llamada total — el primero antes del shutdown)
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    expect(postShutdownResult.success).toBe(false);
    expect(postShutdownResult.errorCode).toBe('WORKER_STOPPED');
  });
});
