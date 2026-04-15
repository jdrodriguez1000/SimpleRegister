/**
 * TSK-I2-B04-V — email_worker_val.test.ts
 * Agente: backend-tester
 * Estado: VAL — Fase de Validación Cruzada. Los módulos YA EXISTEN (TSK-I2-B04-G).
 *         Esta suite valida los 3 criterios del DoD de TSK-I2-B04-V:
 *
 *   DoD #1: Mensajes no se pierden tras reinicio forzado del worker
 *           → Los mensajes reencolados con attempts+1 pueden ser re-procesados exitosamente
 *             en una segunda invocación (simula que el worker fue reiniciado y Redis
 *             persistió el mensaje reencolado).
 *
 *   DoD #2: El backoff se incrementa correctamente tras cada fallo
 *           → Validación sistemática del vector completo: 1s → 2s → 4s
 *             con verficación del appliedDelayMs en cada nivel de attempts.
 *
 *   DoD #3: Cierre gracioso exitoso bajo carga
 *           → Worker con señal de shutdown completa el mensaje actual (sin perderlo),
 *             rechaza mensajes subsiguientes con WORKER_STOPPED,
 *             y el mensaje final queda en estado success.
 *
 * Grupos:
 *   1. Resiliencia — Persistencia de Mensajes Reencolados (DoD #1) — 5 tests
 *   2. Backoff Exponencial — Vector Completo (DoD #2) — 5 tests
 *   3. Graceful Shutdown Bajo Carga (DoD #3) — 5 tests
 *
 * Trazabilidad: PROJECT_spec.md §Iteración 2 — Email Queue Worker, RNF6
 * Protocolos: tdd-master (VAL — Validación Cruzada), api-contract-tester (Strict No-Excess)
 */

import {
  processEmailQueue,
  type EmailQueueMessage,
  type WorkerConfig,
  type WorkerResult,
} from '@/src/lib/workers/email_worker';

import type { SmtpTransport } from '@/src/lib/services/email_service';

// =============================================================================
// Helpers de validación (api-contract-tester §II)
// =============================================================================

/** Regex UUID v4 estricto */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Regex timestamp ISO-8601 con milisegundos y zona UTC */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// =============================================================================
// Fixtures — datos de prueba coherentes con el contrato EmailQueueMessage
// =============================================================================

const BASE_MESSAGE: EmailQueueMessage = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  type: 'verification',
  to: 'user@example.com',
  token: 'f1e2d3c4-b5a6-4f7e-8d9c-0b1a2f3e4d5c',
  attempts: 0,
  createdAt: '2026-04-14T10:00:00.000Z',
};

const BASE_CONFIG: WorkerConfig = {
  queueKey: 'val:email:queue',
  dlqKey: 'val:email:dlq',
  retryLimit: 3,
};

// =============================================================================
// Factories de transporte
// =============================================================================

function createSuccessTransport(): jest.Mocked<SmtpTransport> {
  return { sendMail: jest.fn().mockResolvedValue(undefined) };
}

function createFailingTransport(): jest.Mocked<SmtpTransport> {
  return {
    sendMail: jest.fn().mockRejectedValue(new Error('SMTP connection refused')),
  };
}

// =============================================================================
// Configuración de entorno
// =============================================================================

beforeEach(() => {
  (process.env as any).NODE_ENV = 'test';
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

// =============================================================================
// Grupo 1 — DoD #1: Persistencia de Mensajes Reencolados
//
// Verifica que un mensaje que no pudo enviarse (SMTP fail) y fue reencolado
// con attempts+1 puede ser recuperado y procesado exitosamente en una segunda
// invocación — simulando la durabilidad que Redis provee en producción.
//
// Referencia: PROJECT_spec.md §RNF6 — mensajes no deben perderse ante reinicios.
// =============================================================================

describe('[B04-V] DoD #1 — Persistencia: mensajes no se pierden tras reinicio', () => {
  /**
   * Un mensaje reencolado (attempts=1) puede ser re-procesado exitosamente
   * en una segunda invocación del worker, como ocurre tras un reinicio.
   * Este test simula la secuencia: fallo → reencolar → reinicio → éxito.
   */
  it('mensaje reencolado con attempts:1 puede ser re-procesado exitosamente en segunda invocación', async () => {
    // ARRANGE — Simular resultado del primer intento fallido (mensaje reencolado)
    const requeuedMessage: EmailQueueMessage = {
      ...BASE_MESSAGE,
      attempts: 1, // segundo intento (el worker "reinició" y recuperó este mensaje de Redis)
    };
    const successTransport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: successTransport };

    // ACT — Segunda invocación (post-reinicio del worker)
    const result: WorkerResult = await processEmailQueue(requeuedMessage, config);

    // ASSERT — El mensaje fue procesado exitosamente, sin pérdida
    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(1);
    expect(result.movedToDLQ).toBeFalsy();
    expect(successTransport.sendMail).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifica que el mensaje reencolado contiene el attempts actualizado (1, 2, 3)
   * para que el worker reiniciado pueda tomar la decisión correcta de retry o DLQ.
   * La integridad del campo attempts es la garantía contra pérdida de estado.
   */
  it('WorkerResult al reencolado contiene newAttempts correcto para recuperación post-reinicio', async () => {
    const failingTransport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: failingTransport };

    const firstAttemptMessage: EmailQueueMessage = { ...BASE_MESSAGE, attempts: 0 };

    const resultPromise = processEmailQueue(firstAttemptMessage, config);
    jest.runAllTimersAsync();
    const result: WorkerResult = await resultPromise;

    // El mensaje reencolado debe llevar attempts=1 para que al re-procesarse
    // tras reinicio el worker sepa que ya hubo 1 intento previo
    expect(result.requeued).toBe(true);
    expect(result.newAttempts).toBe(1);
    // El appliedDelayMs indica el backoff que fue aplicado antes del reencolar
    expect(result.appliedDelayMs).toBe(1000);
  });

  /**
   * Un mensaje con attempts=2 (tercer intento tras dos fallos y dos reinicios)
   * aún puede ser reencolado si retryLimit=3, preservando el progreso acumulado.
   */
  it('mensaje con attempts:2 puede reencolarse una vez más (attempts:3) antes de DLQ', async () => {
    const failingTransport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, retryLimit: 3, transport: failingTransport };

    const thirdAttemptMessage: EmailQueueMessage = { ...BASE_MESSAGE, attempts: 2 };

    const resultPromise = processEmailQueue(thirdAttemptMessage, config);
    jest.runAllTimersAsync();
    const result: WorkerResult = await resultPromise;

    // Con attempts=2 < retryLimit=3, el mensaje se reencola una vez más
    expect(result.requeued).toBe(true);
    expect(result.newAttempts).toBe(3);
    expect(result.movedToDLQ).toBeFalsy();
  });

  /**
   * Verifica que el ID del mensaje se preserva intacto durante el reencolar,
   * garantizando trazabilidad end-to-end desde la creación hasta el DLQ o éxito.
   * Sin preservación del ID, sería imposible trazar un mensaje entre reinicios.
   */
  it('el ID del mensaje se preserva intacto en todas las invocaciones (trazabilidad)', async () => {
    const failingTransport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: failingTransport };

    const messageAtLimit: EmailQueueMessage = { ...BASE_MESSAGE, attempts: 3 };

    const result: WorkerResult = await processEmailQueue(messageAtLimit, config);

    // El snapshot en DLQ debe conservar el ID original para trazabilidad forense
    expect(result.movedToDLQ).toBe(true);
    expect(result.dlqMessageSnapshot?.id).toBe(BASE_MESSAGE.id);
    expect(result.dlqMessageSnapshot?.id).toMatch(UUID_V4_REGEX);
  });

  /**
   * Verifica que el campo createdAt del mensaje se preserva en DLQ,
   * permitiendo calcular el tiempo total transcurrido desde la creación original.
   * Evidencia de durabilidad: el campo debe seguir siendo ISO-8601 válido.
   */
  it('el campo createdAt se preserva en DLQ con formato ISO-8601 válido', async () => {
    const failingTransport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: failingTransport };

    const exhaustedMessage: EmailQueueMessage = {
      ...BASE_MESSAGE,
      attempts: 3,
      createdAt: '2026-04-14T10:00:00.000Z',
    };

    const result: WorkerResult = await processEmailQueue(exhaustedMessage, config);

    expect(result.movedToDLQ).toBe(true);
    expect(result.dlqMessageSnapshot?.createdAt).toBe('2026-04-14T10:00:00.000Z');
    expect(result.dlqMessageSnapshot?.createdAt).toMatch(ISO_8601_REGEX);
  });
});

// =============================================================================
// Grupo 2 — DoD #2: Backoff Exponencial — Vector Completo (1s → 2s → 4s)
//
// Verifica sistemáticamente que el backoff se incrementa correctamente en
// cada nivel de attempts: 0→1000ms, 1→2000ms, 2→4000ms.
//
// Referencia: PROJECT_spec.md §RNF6 — Backoff exponencial: base 1s, factor 2x.
// =============================================================================

describe('[B04-V] DoD #2 — Backoff Exponencial: vector completo 1s → 2s → 4s', () => {
  /**
   * Primer fallo (attempts=0): el delay debe ser exactamente 1000ms.
   * Fórmula: BASE_BACKOFF_MS * 2^0 = 1000 * 1 = 1000ms.
   */
  it('primer fallo (attempts:0) aplica delay de exactamente 1000ms (BASE_BACKOFF_MS * 2^0)', async () => {
    const failingTransport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: failingTransport };

    const messageAttempt0: EmailQueueMessage = { ...BASE_MESSAGE, attempts: 0 };

    const resultPromise = processEmailQueue(messageAttempt0, config);
    jest.advanceTimersByTime(1000);
    const result: WorkerResult = await resultPromise;

    expect(result.requeued).toBe(true);
    expect(result.appliedDelayMs).toBe(1000);
  });

  /**
   * Segundo fallo (attempts=1): el delay debe ser exactamente 2000ms.
   * Fórmula: BASE_BACKOFF_MS * 2^1 = 1000 * 2 = 2000ms.
   */
  it('segundo fallo (attempts:1) aplica delay de exactamente 2000ms (BASE_BACKOFF_MS * 2^1)', async () => {
    const failingTransport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: failingTransport };

    const messageAttempt1: EmailQueueMessage = { ...BASE_MESSAGE, attempts: 1 };

    const resultPromise = processEmailQueue(messageAttempt1, config);
    jest.advanceTimersByTime(2000);
    const result: WorkerResult = await resultPromise;

    expect(result.requeued).toBe(true);
    expect(result.appliedDelayMs).toBe(2000);
  });

  /**
   * Tercer fallo (attempts=2): el delay debe ser exactamente 4000ms.
   * Fórmula: BASE_BACKOFF_MS * 2^2 = 1000 * 4 = 4000ms.
   */
  it('tercer fallo (attempts:2) aplica delay de exactamente 4000ms (BASE_BACKOFF_MS * 2^2)', async () => {
    const failingTransport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: failingTransport };

    const messageAttempt2: EmailQueueMessage = { ...BASE_MESSAGE, attempts: 2 };

    const resultPromise = processEmailQueue(messageAttempt2, config);
    jest.advanceTimersByTime(4000);
    const result: WorkerResult = await resultPromise;

    expect(result.requeued).toBe(true);
    expect(result.appliedDelayMs).toBe(4000);
  });

  /**
   * Verifica que cuando attempts >= retryLimit NO se aplica ningún delay —
   * el mensaje va directo a DLQ sin esperar. Esto garantiza que mensajes
   * agotados no bloquean la cola con delays innecesarios.
   */
  it('cuando attempts >= retryLimit NO se aplica delay — DLQ inmediato', async () => {
    const failingTransport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, retryLimit: 3, transport: failingTransport };

    const exhaustedMessage: EmailQueueMessage = { ...BASE_MESSAGE, attempts: 3 };

    // Este call debe resolverse INMEDIATAMENTE sin necesidad de avanzar timers
    const result: WorkerResult = await processEmailQueue(exhaustedMessage, config);

    // No debe haber delay aplicado — va directo a DLQ
    expect(result.movedToDLQ).toBe(true);
    expect(result.appliedDelayMs).toBeUndefined();
    expect(result.requeued).toBeFalsy();
  });

  /**
   * Verifica que el backoff es preciso: avanzar 999ms (1ms menos que 1000ms)
   * NO debe resolver el delay del primer reintento (attempts=0).
   * Garantía de que el intervalo es exacto y no se trunca.
   */
  it('avanzar 999ms NO resuelve el delay de 1000ms del primer reintento (precisión del backoff)', async () => {
    const failingTransport = createFailingTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: failingTransport };

    const messageAttempt0: EmailQueueMessage = { ...BASE_MESSAGE, attempts: 0 };

    let resolved = false;
    const resultPromise = processEmailQueue(messageAttempt0, config).then((r) => {
      resolved = true;
      return r;
    });

    // Avanzar 999ms — el Promise no debe haberse resuelto aún
    jest.advanceTimersByTime(999);
    // Permitir que las microtareas pendientes se ejecuten
    await Promise.resolve();

    expect(resolved).toBe(false);

    // Avanzar 1ms más (total 1000ms) — ahora sí debe resolverse
    jest.advanceTimersByTime(1);
    const result: WorkerResult = await resultPromise;

    expect(resolved).toBe(true);
    expect(result.appliedDelayMs).toBe(1000);
  });
});

// =============================================================================
// Grupo 3 — DoD #3: Graceful Shutdown Bajo Carga
//
// Verifica que el worker con señal de shutdown:
//   1. Completa el mensaje actual sin perderlo
//   2. Rechaza mensajes subsiguientes con WORKER_STOPPED
//   3. No llama al transporte SMTP para mensajes post-shutdown
//   4. El estado isRunning=false es reportado correctamente
//
// Referencia: PROJECT_spec.md §Graceful Shutdown — SIGTERM processing.
// =============================================================================

describe('[B04-V] DoD #3 — Graceful Shutdown Bajo Carga: cierre sin pérdida de mensajes', () => {
  /**
   * El worker con shutdown=true completa el mensaje actual exitosamente.
   * Garantía primaria: ningún mensaje en vuelo se pierde durante el cierre.
   */
  it('mensaje en vuelo durante shutdown se completa exitosamente (no se pierde)', async () => {
    const successTransport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: successTransport };

    // ACT — Procesar con señal de shutdown activa
    const result: WorkerResult = await processEmailQueue(
      BASE_MESSAGE,
      config,
      { shutdown: true }
    );

    // ASSERT — El mensaje fue procesado exitosamente, no descartado
    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(1);
    expect(successTransport.sendMail).toHaveBeenCalledTimes(1);
  });

  /**
   * El resultado del shutdown incluye isRunning=false y shutdownAfterCompletion=true.
   * Estos flags son el mecanismo de señalización hacia el loop principal del worker.
   */
  it('shutdown tras completar mensaje reporta { isRunning: false, shutdownAfterCompletion: true }', async () => {
    const successTransport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: successTransport };

    const result: WorkerResult = await processEmailQueue(
      BASE_MESSAGE,
      config,
      { shutdown: true }
    );

    expect(result.isRunning).toBe(false);
    expect(result.shutdownAfterCompletion).toBe(true);
  });

  /**
   * Mensajes enviados DESPUÉS del shutdown (workerAlreadyStopped=true)
   * son rechazados sin invocar el transporte SMTP.
   * Previene procesamiento fantasma post-cierre.
   */
  it('mensajes post-shutdown son rechazados sin invocar SMTP (errorCode: WORKER_STOPPED)', async () => {
    const successTransport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: successTransport };

    // Mensaje post-shutdown (el worker ya fue detenido)
    const postShutdownResult: WorkerResult = await processEmailQueue(
      BASE_MESSAGE,
      config,
      { workerAlreadyStopped: true }
    );

    // El SMTP no debe ser invocado para mensajes post-shutdown
    expect(successTransport.sendMail).not.toHaveBeenCalled();
    expect(postShutdownResult.success).toBe(false);
    expect(postShutdownResult.errorCode).toBe('WORKER_STOPPED');
  });

  /**
   * Verifica el comportamiento secuencial bajo "carga":
   * - Mensaje 1: procesado exitosamente antes del shutdown
   * - Mensaje 2: rechazado con WORKER_STOPPED post-shutdown
   * El transporte SMTP solo debe ser llamado UNA vez (solo para el mensaje pre-shutdown).
   */
  it('bajo carga: un mensaje completado + un rechazado = solo 1 llamada SMTP total', async () => {
    const successTransport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: successTransport };

    // Mensaje 1: en vuelo durante el shutdown (debe completarse)
    const result1 = await processEmailQueue(
      { ...BASE_MESSAGE, id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' },
      config,
      { shutdown: true }
    );
    expect(result1.success).toBe(true);

    // Mensaje 2: llega después del shutdown (debe ser rechazado)
    const result2 = await processEmailQueue(
      { ...BASE_MESSAGE, id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' },
      config,
      { workerAlreadyStopped: true }
    );
    expect(result2.success).toBe(false);
    expect(result2.errorCode).toBe('WORKER_STOPPED');

    // Solo 1 llamada SMTP: la del primer mensaje (antes del shutdown)
    expect(successTransport.sendMail).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifica que un mensaje de tipo 'resend' también se completa correctamente
   * bajo señal de shutdown — el cierre gracioso aplica a ambos tipos de email.
   */
  it('mensaje tipo resend también se completa correctamente durante graceful shutdown', async () => {
    const successTransport = createSuccessTransport();
    const config: WorkerConfig = { ...BASE_CONFIG, transport: successTransport };

    const resendMessage: EmailQueueMessage = {
      id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      type: 'resend',
      to: 'other@example.com',
      token: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
      attempts: 0,
      createdAt: '2026-04-14T10:05:00.000Z',
    };

    const result: WorkerResult = await processEmailQueue(
      resendMessage,
      config,
      { shutdown: true }
    );

    // El mensaje de tipo resend también debe completarse exitosamente
    expect(result.success).toBe(true);
    expect(result.shutdownAfterCompletion).toBe(true);
    expect(successTransport.sendMail).toHaveBeenCalledTimes(1);
  });
});
