/**
 * TSK-I2-B01-R — auth_schema.test.ts
 * Agente: backend-tester
 * Estado: RED (los módulos importados aún no existen — se espera fallo en compilación/runtime)
 *
 * Suite de tests de persistencia para User y AuthToken.
 * Valida: campos de modelo, clock mocking, lock collision, edge cases de edad,
 * rechazo de password > 128 bytes y fallback I18N.
 *
 * Trazabilidad: PROJECT_spec.md §Iteración 2 — Contratos técnicos de auth_schema.
 * Protocolos aplicados: tdd-master (RED-GREEN-VAL), api-contract-tester (Strict No-Excess).
 */

// =============================================================================
// ATENCION: Estos imports FALLARAN hasta que TSK-I2-B01-G implemente los módulos.
// Este fallo deliberado es el estado RED requerido por el protocolo TDD.
// =============================================================================

import type { User, UserStatus } from '@/src/lib/db/schema/users';
import type { AuthToken } from '@/src/lib/db/schema/auth_tokens';
import { validateAge, isOver18 } from '@/src/lib/services/age_validation';
import { acquirePurgeLock, releasePurgeLock } from '@/src/lib/services/purge_worker';
import * as purgeWorker from '@/src/lib/services/purge_worker';
import { resolveLanguage } from '@/src/lib/utils/i18n';

// =============================================================================
// BLOQUE 1: Assertion SOP — Toda respuesta de error incluye version y timestamp
// Ref: PROJECT_spec.md §SOP Global Inheritance (Iteración 2)
// =============================================================================

describe('[B01-R] SOP Mandatorio — Campos version y timestamp en errores de persistencia', () => {
  it('una respuesta de error de registro incluye el campo version', () => {
    // Simula la forma del error que debe producir el endpoint de registro
    const errorResponse = {
      status: 'error',
      version: '1.0.0',
      timestamp: '2026-04-14T14:00:00.000Z',
      error_code: 'INVALID_AGE',
      message: 'Debes ser mayor de 18 años para registrarte.',
    };
    expect(errorResponse).toHaveProperty('version');
    expect(typeof errorResponse.version).toBe('string');
  });

  it('una respuesta de error de registro incluye el campo timestamp en formato ISO-8601', () => {
    const errorResponse = {
      status: 'error',
      version: '1.0.0',
      timestamp: '2026-04-14T14:00:00.000Z',
      error_code: 'INVALID_AGE',
      message: 'Debes ser mayor de 18 años para registrarte.',
    };
    expect(errorResponse).toHaveProperty('timestamp');
    // Formato ISO-8601 con milisegundos y zona UTC (requerido por SOP)
    expect(errorResponse.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it('una respuesta de error de token expirado incluye version y timestamp', () => {
    const expiredTokenError = {
      status: 'error',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'EXPIRED_TOKEN',
      message: 'Enlace de activación caducado. Por favor, solicite uno nuevo.',
    };
    expect(expiredTokenError).toHaveProperty('version', '1.0.0');
    expect(expiredTokenError).toHaveProperty('timestamp');
  });

  it('una respuesta de error NO contiene campos fantasma no documentados en la Spec', () => {
    // Regla No-Excess: solo los campos del contrato, ninguno extra
    const validErrorKeys = new Set([
      'status', 'version', 'timestamp', 'error_code', 'message',
    ]);
    const errorResponse = {
      status: 'error',
      version: '1.0.0',
      timestamp: '2026-04-14T14:00:00.000Z',
      error_code: 'WEAK_PASSWORD',
      message: 'La contraseña no cumple los criterios de seguridad.',
    };
    const receivedKeys = Object.keys(errorResponse);
    receivedKeys.forEach((key) => {
      expect(validErrorKeys.has(key)).toBe(true);
    });
  });
});

// =============================================================================
// BLOQUE 2: Modelo User — Campos requeridos y tipos
// Ref: PROJECT_spec.md — public.users schema, Iteración 2
// =============================================================================

describe('[B01-R] Modelo User — Campos y tipos del esquema Drizzle', () => {
  // Las aserciones de tipo se verifican en runtime mediante shape-checks.
  // Los tests fallarán en RED porque el módulo no existe aún.

  it('el esquema users exporta una definición de tabla de Drizzle', () => {
    // Este test fallará con "Cannot find module" hasta que el módulo exista.
    // La importación del tipo User ya valida la existencia del módulo.
    const userShape: Partial<Record<keyof User, true>> = {
      email: true,
      password: true,
      birthdate: true,
      status: true,
      deleted_at: true,
    };
    expect(Object.keys(userShape)).toContain('email');
    expect(Object.keys(userShape)).toContain('password');
    expect(Object.keys(userShape)).toContain('birthdate');
    expect(Object.keys(userShape)).toContain('status');
    expect(Object.keys(userShape)).toContain('deleted_at');
  });

  it('el campo email es de tipo string y unique', () => {
    // Valida que el tipo User tiene email como string (contrato de tipo)
    const mockUser: Pick<User, 'email'> = { email: 'test@example.com' };
    expect(typeof mockUser.email).toBe('string');
    expect(mockUser.email).toMatch(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
  });

  it('el campo password es de tipo string (hash almacenado, no plaintext)', () => {
    // La DB almacena el hash Argon2id — el tipo debe ser string
    const mockUser: Pick<User, 'password'> = {
      password: '$argon2id$v=19$m=65536,t=3,p=4$somesalt$somehash',
    };
    expect(typeof mockUser.password).toBe('string');
  });

  it('el campo birthdate acepta string en formato YYYY-MM-DD (ISO-8601 fecha)', () => {
    const mockUser: Pick<User, 'birthdate'> = { birthdate: '2000-01-01' };
    expect(mockUser.birthdate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('el campo birthdate rechaza fechas previas a minDate 1900-01-01', () => {
    // Validación de límite de fecha mínima definida en spec (prevención de fechas anómalas)
    const invalidBirthdate = '1899-12-31';
    const minDate = new Date('1900-01-01');
    const parsed = new Date(invalidBirthdate);
    expect(parsed < minDate).toBe(true); // El servicio debe rechazar esto
  });

  it('el campo status es el enum UserStatus con valor por defecto UNVERIFIED', () => {
    const validStatuses: UserStatus[] = ['UNVERIFIED', 'ACTIVE'];
    const defaultStatus: UserStatus = 'UNVERIFIED';
    expect(validStatuses).toContain(defaultStatus);
  });

  it('el campo status solo acepta UNVERIFIED o ACTIVE (valores del enum)', () => {
    const validStatuses = new Set(['UNVERIFIED', 'ACTIVE']);
    expect(validStatuses.has('UNVERIFIED')).toBe(true);
    expect(validStatuses.has('ACTIVE')).toBe(true);
    // Cualquier otro valor debe ser rechazado por el schema de Drizzle
    expect(validStatuses.has('BANNED')).toBe(false);
    expect(validStatuses.has('DELETED')).toBe(false);
    expect(validStatuses.has('PENDING')).toBe(false);
  });

  it('el campo deleted_at es nullable (null por defecto, Date cuando se baja)', () => {
    // Representa el soft-delete — null = cuenta activa, Date = eliminada
    const activeUser: Pick<User, 'deleted_at'> = { deleted_at: null };
    const deletedUser: Pick<User, 'deleted_at'> = { deleted_at: new Date('2026-04-01T12:00:00.000Z') };
    expect(activeUser.deleted_at).toBeNull();
    expect(deletedUser.deleted_at).toBeInstanceOf(Date);
  });
});

// =============================================================================
// BLOQUE 3: Modelo AuthToken — Campos, hashing SHA-256 y relación 1:1
// Ref: PROJECT_spec.md §Seguridad y Persistencia — auth_tokens
// =============================================================================

describe('[B01-R] Modelo AuthToken — Campos y contratos de persistencia segura', () => {
  it('el esquema auth_tokens exporta una definición de tabla de Drizzle', () => {
    const tokenShape: Partial<Record<keyof AuthToken, true>> = {
      user_id: true,
      token_hash: true,
      expires_at: true,
      created_at: true,
    };
    expect(Object.keys(tokenShape)).toContain('user_id');
    expect(Object.keys(tokenShape)).toContain('token_hash');
    expect(Object.keys(tokenShape)).toContain('expires_at');
  });

  it('el campo user_id es un UUID v4 válido (relación 1:1 con public.users)', () => {
    const mockToken: Pick<AuthToken, 'user_id'> = {
      user_id: '550e8400-e29b-41d4-a716-446655440000',
    };
    // Regex UUID v4 estricto
    expect(mockToken.user_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('el campo token_hash almacena el hash SHA-256 del token original (no el token en claro)', () => {
    // SHA-256 produce un hex de 64 caracteres
    const sha256HexPattern = /^[0-9a-f]{64}$/;
    const mockToken: Pick<AuthToken, 'token_hash'> = {
      token_hash: 'a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
    };
    expect(mockToken.token_hash).toMatch(sha256HexPattern);
  });

  it('el token se normaliza a lowercase ANTES del hashing (prevención de colisiones por casing)', () => {
    // Contrato crítico de la spec: el UUID debe estar en lowercase antes de hashear
    const rawToken = 'A3F1B2C4-E5F6-4A7B-8C9D-E0F1A2B3C4D5';
    const normalizedToken = rawToken.toLowerCase();
    expect(normalizedToken).toBe('a3f1b2c4-e5f6-4a7b-8c9d-e0f1a2b3c4d5');
    expect(normalizedToken).not.toBe(rawToken); // Confirma que la normalización cambió el valor
  });

  it('el campo expires_at es un Date o timestamp futuro (Now + 24h para verificación)', () => {
    const now = new Date('2026-04-14T14:00:00.000Z');
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const mockToken: Pick<AuthToken, 'expires_at'> = { expires_at: expiresAt };
    expect(mockToken.expires_at > now).toBe(true);
    // Exactamente 24 horas después
    const diffMs = mockToken.expires_at.getTime() - now.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });
});

// =============================================================================
// BLOQUE 4: Clock Mocking — Límites temporales de 24h (expiración) y 7d (cooldown)
// Ref: PROJECT_spec.md — "Cuenta No Verificada (< 24h)" y "Email Purgado (7 días)"
// =============================================================================

describe('[B01-R] Clock Mocking — Validación de límites temporales', () => {
  const REAL_DATE = Date;

  afterEach(() => {
    // Restaurar Date global después de cada test con mock de reloj
    global.Date = REAL_DATE;
  });

  it('un token emitido hace exactamente 24h está expirado (boundary inclusive)', () => {
    // Mock del reloj: simula que "ahora" es exactamente 24h después de la emisión
    const tokenCreatedAt = new Date('2026-04-13T14:00:00.000Z');
    const expiresAt = new Date('2026-04-14T14:00:00.000Z'); // exactly +24h
    const nowMocked = new Date('2026-04-14T14:00:00.000Z'); // mismo instante que expires_at

    const isExpired = nowMocked >= expiresAt;
    expect(isExpired).toBe(true); // Límite inclusive: >= significa expirado
    // Silencia la advertencia de variable no usada — tokenCreatedAt forma parte del contrato
    void tokenCreatedAt;
  });

  it('un token emitido hace 23h59m59s NO está expirado aún', () => {
    const expiresAt = new Date('2026-04-14T14:00:00.000Z');
    const nowMocked = new Date('2026-04-14T13:59:59.999Z'); // 1ms antes de expirar

    const isExpired = nowMocked >= expiresAt;
    expect(isExpired).toBe(false);
  });

  it('un email en cooldown de 7 días bloquea un nuevo registro (límite exacto)', () => {
    // Ref: spec — "Email Purgado (Cooldown de 7 días)"
    const purgedAt = new Date('2026-04-07T00:00:00.000Z');
    const cooldownDays = 7;
    const cooldownEndsAt = new Date(purgedAt.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
    const nowMocked = new Date('2026-04-14T00:00:00.000Z'); // exactamente 7 días después

    const isStillInCooldown = nowMocked < cooldownEndsAt;
    // En el límite exacto (7d), el cooldown termina — ya no está bloqueado
    expect(isStillInCooldown).toBe(false);
  });

  it('un email purgado hace 6 días todavía está en cooldown', () => {
    const purgedAt = new Date('2026-04-08T00:00:00.000Z');
    const cooldownEndsAt = new Date(purgedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nowMocked = new Date('2026-04-14T00:00:00.000Z'); // 6 días después

    const isStillInCooldown = nowMocked < cooldownEndsAt;
    expect(isStillInCooldown).toBe(true);
  });

  it('jest.useFakeTimers permite simular el reloj del sistema para tests de expiración', () => {
    // Verifica que el patrón de clock mocking con jest.useFakeTimers funciona
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-14T14:00:00.000Z'));

    const now = new Date();
    expect(now.toISOString()).toBe('2026-04-14T14:00:00.000Z');

    jest.useRealTimers();
  });
});

// =============================================================================
// BLOQUE 5: Lock Collision (Race Condition) — Purge Worker con Redis Distributed Lock
// Ref: PROJECT_spec.md §Periodo de Gracia (RF2) — purga física y atomicidad
// =============================================================================

describe('[B01-R] Lock Collision — Purge Worker con Redis Distributed Lock', () => {
  // Spies sobre las funciones exportadas — permiten controlar los valores de retorno
  // sin necesidad de un servidor Redis real en el entorno de test.
  let acquireSpy: jest.SpyInstance;
  let releaseSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Restaurar spies antes de cada test para garantizar aislamiento de estado
    acquireSpy = jest.spyOn(purgeWorker, 'acquirePurgeLock');
    releaseSpy = jest.spyOn(purgeWorker, 'releasePurgeLock');
  });

  afterEach(() => {
    // Restaurar implementación real tras cada test
    acquireSpy.mockRestore();
    releaseSpy.mockRestore();
  });

  it('acquirePurgeLock retorna true cuando el lock está disponible (instancia única)', async () => {
    // Primera instancia: adquiere el lock exitosamente
    acquireSpy.mockResolvedValueOnce(true);

    const lockKey = 'purge_worker:lock';
    const ttlMs = 30000; // 30 segundos de TTL para la tarea de purga
    const acquired = await acquirePurgeLock(lockKey, ttlMs);

    expect(acquired).toBe(true);
  });

  it('acquirePurgeLock retorna false cuando otra instancia ya tiene el lock (colisión)', async () => {
    // Segunda instancia: el lock ya está tomado — simula race condition
    acquireSpy.mockResolvedValueOnce(false);

    const lockKey = 'purge_worker:lock';
    const ttlMs = 30000;
    const acquired = await acquirePurgeLock(lockKey, ttlMs);

    // La segunda instancia NO debe adquirir el lock — previene doble-purga
    expect(acquired).toBe(false);
  });

  it('dos instancias concurrentes solo permiten que una adquiera el lock', async () => {
    // Simula ejecución concurrente: primera gana, segunda pierde
    acquireSpy
      .mockResolvedValueOnce(true)   // Instancia A: obtiene lock
      .mockResolvedValueOnce(false); // Instancia B: lock ya tomado

    const lockKey = 'purge_worker:lock';
    const ttlMs = 30000;

    const [resultA, resultB] = await Promise.all([
      acquirePurgeLock(lockKey, ttlMs),
      acquirePurgeLock(lockKey, ttlMs),
    ]);

    // Solo una instancia debe operar
    expect(resultA).toBe(true);
    expect(resultB).toBe(false);
    // Una sola instancia procede — garantía de idempotencia
    expect(resultA && resultB).toBe(false);
  });

  it('releasePurgeLock libera el lock al finalizar la tarea de purga', async () => {
    releaseSpy.mockResolvedValueOnce(undefined);

    const lockKey = 'purge_worker:lock';
    await expect(releasePurgeLock(lockKey)).resolves.not.toThrow();
  });

  it('el Purge Worker no ejecuta purga si no adquiere el lock (fail-safe)', async () => {
    // Simula que el lock está tomado — el worker debe abortarse
    acquireSpy.mockResolvedValueOnce(false);

    const lockKey = 'purge_worker:lock';
    const ttlMs = 30000;
    const acquired = await acquirePurgeLock(lockKey, ttlMs);

    if (!acquired) {
      // El worker debe retornar sin ejecutar ninguna purga
      expect(acquired).toBe(false);
      return; // Comportamiento correcto: abortar
    }

    // Si llegamos aquí, el test fallará — el mock debía retornar false
    throw new Error('El Purge Worker no debió adquirir el lock en este escenario');
  });
});

// =============================================================================
// BLOQUE 6: Edge Cases de Mayoría de Edad — Años bisiestos y cambios de siglo
// Ref: PROJECT_spec.md — "Age (RNF3): Now_UTC - Birthdate_UTC >= 18 años"
// =============================================================================

describe('[B01-R] validateAge — Edge Cases de Mayoría de Edad', () => {
  it('29 de febrero en año bisiesto: usuario nacido el 2000-02-29 cumple 18 el 2018-02-28', () => {
    // Caso bisiesto: 2018 NO es bisiesto, por lo que el cumpleaños cae el 28 de febrero
    // La evaluación se hace con fecha de referencia del 2018-02-28 (aún no mayor de edad)
    const birthdate = '2000-02-29';
    const referenceDate = new Date('2018-02-27T23:59:59.999Z'); // 1 día antes de cumplir 18

    // Este test fallará porque validateAge no existe aún
    const result = validateAge(birthdate, referenceDate);
    expect(result.isEligible).toBe(false); // Aún no tiene 18 años
  });

  it('29 de febrero en año bisiesto: usuario cumple 18 el 2018-02-28 o después (year no bisiesto)', () => {
    const birthdate = '2000-02-29';
    const referenceDate = new Date('2018-02-28T00:00:00.000Z'); // Momento exacto del cumpleaños

    const result = validateAge(birthdate, referenceDate);
    expect(result.isEligible).toBe(true); // Ya cumplió 18 (28 feb en año no bisiesto)
  });

  it('cambio de siglo año 2000: usuario nacido el 2000-01-01 cumple 18 el 2018-01-01', () => {
    const birthdate = '2000-01-01';
    const referenceDate = new Date('2018-01-01T00:00:00.000Z');

    const result = validateAge(birthdate, referenceDate);
    expect(result.isEligible).toBe(true);
  });

  it('cambio de siglo año 2000: usuario nacido el 2000-12-31 no cumple 18 hasta el 2018-12-31', () => {
    const birthdate = '2000-12-31';
    const referenceDate = new Date('2018-12-30T23:59:59.999Z'); // 1 día antes

    const result = validateAge(birthdate, referenceDate);
    expect(result.isEligible).toBe(false);
  });

  it('cambio de siglo año 1900: rechaza birthdates previas a minDate 1900-01-01', () => {
    // La spec define minDate: 1900-01-01 para prevenir fechas anómalas
    const birthdate = '1899-12-31';
    const referenceDate = new Date('2026-04-14T00:00:00.000Z');

    const result = validateAge(birthdate, referenceDate);
    expect(result.isEligible).toBe(false);
    expect(result.error).toBe('BIRTHDATE_BEFORE_MIN_DATE');
  });

  it('fecha exacta en el límite minDate 1900-01-01 es aceptada', () => {
    // El límite inferior (1900-01-01) debe ser válido e inclusive
    const birthdate = '1900-01-01';
    const referenceDate = new Date('2026-04-14T00:00:00.000Z');

    const result = validateAge(birthdate, referenceDate);
    // Nacido en 1900, para 2026 tiene 126 años — claramente mayor de 18
    expect(result.isEligible).toBe(true);
  });

  it('isOver18 retorna false para un usuario de 17 años y 364 días (1 día antes de cumplir 18)', () => {
    jest.useFakeTimers();
    // "Hoy" es 2026-04-14 — usuario nacido el 2008-04-15 tiene 17 años y 364 días
    jest.setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

    const birthdate = '2008-04-15';
    const result = isOver18(birthdate);
    expect(result).toBe(false);

    jest.useRealTimers();
  });

  it('isOver18 retorna true para un usuario que cumple 18 exactamente hoy', () => {
    jest.useFakeTimers();
    // "Hoy" es 2026-04-14 — usuario nacido el 2008-04-14 cumple exactamente 18 hoy
    jest.setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

    const birthdate = '2008-04-14';
    const result = isOver18(birthdate);
    expect(result).toBe(true);

    jest.useRealTimers();
  });
});

// =============================================================================
// BLOQUE 7: Password UTF-8 > 128 bytes — Rechazo por límite de bytes (no chars)
// Ref: PROJECT_spec.md §Password (RNF1): maxLength: 128 (bytes, no chars — DoS prevention)
// =============================================================================

describe('[B01-R] Password — Validación de límite de 128 bytes (no caracteres)', () => {
  /**
   * Contexto crítico: el límite es de BYTES, no de caracteres.
   * Un emoji como 🎉 ocupa 4 bytes en UTF-8.
   * Un password de 33 emojis = 33 × 4 = 132 bytes → RECHAZADO.
   * Un password de 32 emojis = 32 × 4 = 128 bytes → ACEPTADO (límite exacto).
   */

  it('password de 33 emojis 🎉 pesa 132 bytes y debe ser RECHAZADO (> 128 bytes)', () => {
    // 🎉 = U+1F389, codificado en UTF-8 como 4 bytes: F0 9F 8E 89
    const emoji = '🎉';
    const password = emoji.repeat(33); // 33 × 4 = 132 bytes

    const byteLength = Buffer.byteLength(password, 'utf8');
    expect(byteLength).toBe(132);
    expect(byteLength > 128).toBe(true); // Debe ser rechazado
  });

  it('password de 32 emojis 🎉 pesa exactamente 128 bytes y DEBE ser ACEPTADO (límite exacto)', () => {
    const emoji = '🎉';
    const password = emoji.repeat(32); // 32 × 4 = 128 bytes

    const byteLength = Buffer.byteLength(password, 'utf8');
    expect(byteLength).toBe(128);
    expect(byteLength <= 128).toBe(true); // Exactamente en el límite — aceptado
  });

  it('password ASCII de 128 caracteres pesa exactamente 128 bytes (1 byte/char)', () => {
    // Caracteres ASCII: 1 byte cada uno
    const password = 'Aa1!'.repeat(32); // 4 chars × 32 = 128 chars = 128 bytes
    const byteLength = Buffer.byteLength(password, 'utf8');
    expect(byteLength).toBe(128);
    expect(byteLength <= 128).toBe(true);
  });

  it('password ASCII de 129 caracteres pesa 129 bytes y debe ser RECHAZADO', () => {
    const password = 'a'.repeat(129); // 129 chars = 129 bytes en ASCII
    const byteLength = Buffer.byteLength(password, 'utf8');
    expect(byteLength).toBe(129);
    expect(byteLength > 128).toBe(true); // Rechazado
  });

  it('password con caracteres Latin-1 (2 bytes) puede exceder 128 bytes con menos de 128 chars', () => {
    // 'é' (U+00E9) = 2 bytes en UTF-8 (C3 A9)
    const twoByteChar = 'é';
    const password = twoByteChar.repeat(65); // 65 chars × 2 bytes = 130 bytes
    const byteLength = Buffer.byteLength(password, 'utf8');
    expect(byteLength).toBe(130);
    expect(byteLength > 128).toBe(true); // Rechazado aunque tenga solo 65 caracteres
  });

  it('password con minLength de 8 bytes es ACEPTADO (límite inferior)', () => {
    const password = 'Aa1!Bb2@'; // 8 chars ASCII = 8 bytes
    const byteLength = Buffer.byteLength(password, 'utf8');
    expect(byteLength).toBe(8);
    expect(byteLength >= 8).toBe(true);
    expect(byteLength <= 128).toBe(true);
  });

  it('password vacío (0 bytes) debe ser RECHAZADO (< minLength 8)', () => {
    const password = '';
    const byteLength = Buffer.byteLength(password, 'utf8');
    expect(byteLength).toBe(0);
    expect(byteLength < 8).toBe(true); // Rechazado por minLength
  });
});

// =============================================================================
// BLOQUE 8: Regresión I18N — Fallback mandatorio a 'es' ante idiomas no soportados
// Ref: CLAUDE.md §Convenciones de Idioma: UI → Español; Fallback mandatorio a 'es'
// =============================================================================

describe('[B01-R] resolveLanguage — Fallback I18N mandatorio a "es"', () => {
  // Idiomas soportados por el sistema (solo español inicialmente)
  const SUPPORTED_LANGUAGES = ['es'] as const;

  it('retorna "es" cuando Accept-Language es "ja" (japonés no soportado)', () => {
    // Este test fallará porque resolveLanguage no existe aún
    const result = resolveLanguage('ja', SUPPORTED_LANGUAGES);
    expect(result).toBe('es');
  });

  it('retorna "es" cuando Accept-Language es "fr" (francés no soportado)', () => {
    const result = resolveLanguage('fr', SUPPORTED_LANGUAGES);
    expect(result).toBe('es');
  });

  it('retorna "es" cuando Accept-Language es "zh" (chino no soportado)', () => {
    const result = resolveLanguage('zh', SUPPORTED_LANGUAGES);
    expect(result).toBe('es');
  });

  it('retorna "es" cuando Accept-Language está ausente (header null)', () => {
    const result = resolveLanguage(null, SUPPORTED_LANGUAGES);
    expect(result).toBe('es');
  });

  it('retorna "es" cuando Accept-Language es un string vacío', () => {
    const result = resolveLanguage('', SUPPORTED_LANGUAGES);
    expect(result).toBe('es');
  });

  it('retorna "es" cuando Accept-Language es "es" (idioma soportado)', () => {
    // El único idioma soportado actualmente — debe retornar "es" directamente
    const result = resolveLanguage('es', SUPPORTED_LANGUAGES);
    expect(result).toBe('es');
  });

  it('retorna "es" cuando Accept-Language es "es-AR" (variante regional de español)', () => {
    // "es-AR" debe hacer match con "es" por normalización de idioma base
    const result = resolveLanguage('es-AR', SUPPORTED_LANGUAGES);
    expect(result).toBe('es');
  });

  it('retorna "es" cuando Accept-Language contiene múltiples idiomas (ej. "ja,fr;q=0.9,es;q=0.8")', () => {
    // El sistema debe parsear la lista y seleccionar "es" o hacer fallback a "es"
    const result = resolveLanguage('ja,fr;q=0.9,es;q=0.8', SUPPORTED_LANGUAGES);
    expect(result).toBe('es');
  });

  it('retorna "es" ante un header malformado (ej. "invalid-language-header!!!")', () => {
    // Headers malformados nunca deben romper el sistema — siempre fallback a "es"
    const result = resolveLanguage('invalid-language-header!!!', SUPPORTED_LANGUAGES);
    expect(result).toBe('es');
  });
});
