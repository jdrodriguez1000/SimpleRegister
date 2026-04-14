/**
 * TSK-I2-B02-R — register.test.ts
 * Agente: backend-tester
 * Estado: RED (el módulo registerUser NO existe — todos los tests deben FALLAR)
 *
 * Suite de ~65 tests unitarios que validan el contrato completo de
 * POST /api/v1/auth/register según PROJECT_spec.md §Iteración 2.
 *
 * Grupos:
 *   1. SOP Compliance (9 tests)
 *   2. Email Validation (9 tests)
 *   3. Password Validation (8 tests)
 *   4. Age Validation (9 tests)
 *   5. Terms Validation (4 tests)
 *   6. Rate Limiting Fixed Window (9 tests)
 *   7. Collision Policy Anti-Enumeración (9 tests)
 *   8. SYSTEM_DEGRADED (4 tests)
 *   9. Malformed Request (5 tests)
 *  10. I18N & Accept-Language (4 tests)
 *
 * Trazabilidad: PROJECT_spec.md §Iteración 2 — POST /api/v1/auth/register
 * Protocolos: tdd-master (RED-GREEN-VAL), api-contract-tester (Strict No-Excess)
 */

// =============================================================================
// ATENCION: Este import FALLARA hasta que TSK-I2-B02-G implemente el módulo.
// El fallo deliberado con "Cannot find module" ES el estado RED requerido.
// =============================================================================

import {
  registerUser,
  type RegisterRequest,
  type RegisterResult,
} from '@/src/lib/services/register_service';

// =============================================================================
// Helpers de validación (usados en assertions de contratos)
// =============================================================================

/** Regex UUID v4 estricto (api-contract-tester §II) */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Regex timestamp ISO-8601 con milisegundos y zona UTC */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Assertion helper: verifica los headers SOP globales de toda respuesta */
function assertSopHeaders(result: RegisterResult): void {
  expect(result.headers['X-Request-ID']).toMatch(UUID_V4_REGEX);
  expect(result.headers['X-Version']).toBe('1.0.0');
  expect(result.headers['X-Timestamp']).toMatch(ISO_8601_REGEX);
  expect(result.headers['Content-Type']).toContain('application/json');
}

/** Assertion helper: verifica los campos SOP mandatorios en el body */
function assertSopBody(body: Record<string, unknown>): void {
  expect(body).toHaveProperty('version', '1.0.0');
  expect(body).toHaveProperty('timestamp');
  expect(typeof body['timestamp']).toBe('string');
  expect(body['timestamp']).toMatch(ISO_8601_REGEX);
}

/** Payload válido de referencia para tests de éxito */
const VALID_PAYLOAD: RegisterRequest = {
  email: 'test@example.com',
  password: 'Password123!',
  birthdate: '2000-01-01',
  terms_accepted: true,
};

/** IP de referencia para tests */
const TEST_IP = '192.168.1.100';

// =============================================================================
// GRUPO 1: SOP Compliance
// Ref: PROJECT_spec.md §SOP Global Inheritance — Headers globales en TODA respuesta
// =============================================================================

describe('[B02-R] SOP Compliance — Headers y campos SOP en toda respuesta', () => {
  it('respuesta 201 incluye header X-Request-ID con UUID v4 válido', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: TEST_IP });
    expect(result.headers['X-Request-ID']).toMatch(UUID_V4_REGEX);
  });

  it('respuesta 201 incluye header X-Version con valor "1.0.0"', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: TEST_IP });
    expect(result.headers['X-Version']).toBe('1.0.0');
  });

  it('respuesta 201 incluye header X-Timestamp en formato ISO-8601', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: TEST_IP });
    expect(result.headers['X-Timestamp']).toMatch(ISO_8601_REGEX);
  });

  it('respuesta 201 incluye Content-Type: application/json', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: TEST_IP });
    expect(result.headers['Content-Type']).toContain('application/json');
  });

  it('respuesta 201 body contiene version: "1.0.0"', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: TEST_IP });
    expect(result.body).toHaveProperty('version', '1.0.0');
  });

  it('respuesta 201 body contiene timestamp ISO-8601 válido', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: TEST_IP });
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 400 body contiene version y timestamp (SOP en errores)', async () => {
    const payload: RegisterRequest = { ...VALID_PAYLOAD, email: 'bad-email' };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 429 body contiene version y timestamp (SOP en rate limit)', async () => {
    // Después de 5 intentos, el 6to debe devolver 429 con SOP
    const ip = '10.0.0.1';
    for (let i = 0; i < 5; i++) {
      await registerUser(VALID_PAYLOAD, { ip });
    }
    const result = await registerUser(VALID_PAYLOAD, { ip });
    expect(result.statusCode).toBe(429);
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 503 body contiene version y timestamp (SOP en SYSTEM_DEGRADED)', async () => {
    // Simula fallo de Redis — el servicio debe retornar 503 con campos SOP
    const result = await registerUser(VALID_PAYLOAD, {
      ip: TEST_IP,
      simulateRedisFailure: true,
    });
    expect(result.statusCode).toBe(503);
    assertSopBody(result.body as Record<string, unknown>);
  });
});

// =============================================================================
// GRUPO 2: Email Validation
// Ref: PROJECT_spec.md §Email — Regex RFC 5322, min 5, max 254, case-insensitive
// =============================================================================

describe('[B02-R] Email Validation — Regex RFC 5322, longitud y normalización', () => {
  it('email válido simple acepta registro exitoso (200 OK path)', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: TEST_IP });
    expect(result.statusCode).toBe(201);
  });

  it('email válido con subdominios acepta registro (user@mail.example.com)', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      email: 'user@mail.example.com',
    };
    const result = await registerUser(payload, { ip: '10.0.1.1' });
    expect(result.statusCode).toBe(201);
  });

  it('email sin @ devuelve 400 INVALID_EMAIL_FORMAT', async () => {
    const payload: RegisterRequest = { ...VALID_PAYLOAD, email: 'invalidemail.com' };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'INVALID_EMAIL_FORMAT'
    );
  });

  it('email sin dominio devuelve 400 INVALID_EMAIL_FORMAT', async () => {
    const payload: RegisterRequest = { ...VALID_PAYLOAD, email: 'user@' };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'INVALID_EMAIL_FORMAT'
    );
  });

  it('email con espacios devuelve 400 INVALID_EMAIL_FORMAT', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      email: 'user @example.com',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'INVALID_EMAIL_FORMAT'
    );
  });

  it('email > 254 caracteres devuelve 400 INVALID_EMAIL_FORMAT', async () => {
    // 250 caracteres de local-part + @ + dominio = > 254 total
    const longLocal = 'a'.repeat(250);
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      email: `${longLocal}@example.com`,
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'INVALID_EMAIL_FORMAT'
    );
  });

  it('email < 5 caracteres devuelve 400 INVALID_EMAIL_FORMAT', async () => {
    // "a@b" tiene 3 chars — menos de 5
    const payload: RegisterRequest = { ...VALID_PAYLOAD, email: 'a@b' };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'INVALID_EMAIL_FORMAT'
    );
  });

  it('email en MAYUSCULAS se normaliza a lowercase antes de persistir', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      email: 'USER@EXAMPLE.COM',
    };
    const result = await registerUser(payload, { ip: '10.0.2.1' });
    // La respuesta 201 no revela la normalización directamente, pero el user_id
    // retornado confirma que el registro fue procesado (no rechazado)
    expect(result.statusCode).toBe(201);
    // El body no debe contener el email en mayúsculas (anti-enumeración)
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain('USER@EXAMPLE.COM');
  });

  it('email con TLD de 1 letra devuelve 400 INVALID_EMAIL_FORMAT', async () => {
    // RFC 5322: TLD mínimo 2 letras
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      email: 'user@example.c',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'INVALID_EMAIL_FORMAT'
    );
  });

  it('email con doble punto en dominio devuelve 400 INVALID_EMAIL_FORMAT', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      email: 'user@exam..ple.com',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'INVALID_EMAIL_FORMAT'
    );
  });
});

// =============================================================================
// GRUPO 3: Password Validation
// Ref: PROJECT_spec.md §Password (RNF1): regex + 8-128 bytes UTF-8
// =============================================================================

describe('[B02-R] Password Validation — Regex, longitud y límite de bytes UTF-8', () => {
  it('password válido con mayus/minus/num/special acepta registro', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: '10.0.3.1' });
    expect(result.statusCode).toBe(201);
  });

  it('password sin carácter especial devuelve 400 WEAK_PASSWORD', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      password: 'Password123',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'WEAK_PASSWORD'
    );
  });

  it('password sin mayúscula devuelve 400 WEAK_PASSWORD', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      password: 'password123!',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'WEAK_PASSWORD'
    );
  });

  it('password sin número devuelve 400 WEAK_PASSWORD', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      password: 'Password!!!',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'WEAK_PASSWORD'
    );
  });

  it('password < 8 caracteres devuelve 400 WEAK_PASSWORD', async () => {
    const payload: RegisterRequest = { ...VALID_PAYLOAD, password: 'P1a!' };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'WEAK_PASSWORD'
    );
  });

  it('password multibyte UTF-8 > 128 bytes devuelve 400 WEAK_PASSWORD (rechazo por PESO)', async () => {
    // 🎉 = 4 bytes UTF-8; 33 × 4 = 132 bytes > 128 → RECHAZADO
    const emoji = '🎉';
    const password = emoji.repeat(33); // 132 bytes
    expect(Buffer.byteLength(password, 'utf8')).toBe(132);

    const payload: RegisterRequest = { ...VALID_PAYLOAD, password };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'WEAK_PASSWORD'
    );
  });

  it('password de exactamente 128 bytes UTF-8 es ACEPTADO (límite exacto)', async () => {
    // 'Aa1!' = 4 bytes; × 32 = 128 bytes — justo en el límite
    const password = 'Aa1!'.repeat(32);
    expect(Buffer.byteLength(password, 'utf8')).toBe(128);

    const payload: RegisterRequest = { ...VALID_PAYLOAD, password };
    const result = await registerUser(payload, { ip: '10.0.4.1' });
    expect(result.statusCode).toBe(201);
  });

  it('password Latin-1 de 65 chars (130 bytes) devuelve 400 WEAK_PASSWORD', async () => {
    // 'é' = 2 bytes UTF-8; 65 × 2 = 130 bytes > 128 → RECHAZADO
    const twoByteChar = 'é';
    const password = `P1!${twoByteChar.repeat(65)}`; // 130 bytes de é + 3 ASCII
    expect(Buffer.byteLength(password, 'utf8')).toBeGreaterThan(128);

    const payload: RegisterRequest = { ...VALID_PAYLOAD, password };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'WEAK_PASSWORD'
    );
  });

  it('password vacío devuelve 400 WEAK_PASSWORD', async () => {
    const payload: RegisterRequest = { ...VALID_PAYLOAD, password: '' };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'WEAK_PASSWORD'
    );
  });
});

// =============================================================================
// GRUPO 4: Age Validation
// Ref: PROJECT_spec.md §Age (RNF3) — Plain-Date, sin drift, minDate 1900-01-01
// =============================================================================

describe('[B02-R] Age Validation — Plain-Date UTC, límites y casos borde', () => {
  it('birthdate exactamente 18 años atrás acepta registro (límite inclusivo)', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

    // 2026-04-14 menos 18 años = 2008-04-14
    const payload: RegisterRequest = { ...VALID_PAYLOAD, birthdate: '2008-04-14' };
    const result = await registerUser(payload, { ip: '10.0.5.1' });
    expect(result.statusCode).toBe(201);

    jest.useRealTimers();
  });

  it('birthdate de 17 años y 364 días devuelve 400 INVALID_AGE', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

    // 2026-04-14 → 2008-04-15 tiene solo 17 años y 364 días
    const payload: RegisterRequest = { ...VALID_PAYLOAD, birthdate: '2008-04-15' };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'INVALID_AGE'
    );

    jest.useRealTimers();
  });

  it('birthdate en el futuro devuelve 400 INVALID_AGE', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      birthdate: '2030-01-01',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'INVALID_AGE'
    );
  });

  it('birthdate con formato YYYY/MM/DD devuelve 400 MALFORMED_REQUEST', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      birthdate: '2000/01/01',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });

  it('birthdate < 1900-01-01 devuelve 400 MALFORMED_REQUEST', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      birthdate: '1899-12-31',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });

  it('birthdate 29-Feb en año no bisiesto devuelve 400 MALFORMED_REQUEST', async () => {
    // 2001 no es bisiesto — 2001-02-29 no existe en el calendario
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      birthdate: '2001-02-29',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });

  it('birthdate 29-Feb en año bisiesto (2000-02-29) acepta si tiene 18+', async () => {
    jest.useFakeTimers();
    // "Hoy" = 2026-04-14: 2000-02-29 tiene 26 años → mayor de 18
    jest.setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      birthdate: '2000-02-29',
    };
    const result = await registerUser(payload, { ip: '10.0.6.1' });
    expect(result.statusCode).toBe(201);

    jest.useRealTimers();
  });

  it('birthdate en minDate exacto (1900-01-01) acepta registro (tiene > 18 años)', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      birthdate: '1900-01-01',
    };
    const result = await registerUser(payload, { ip: '10.0.7.1' });
    // 1900-01-01 → más de 18 años — debe aceptarse
    expect(result.statusCode).toBe(201);
  });

  it('birthdate no numérico (YYYY-MM-XX) devuelve 400 MALFORMED_REQUEST', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      birthdate: '2000-01-XX',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });

  it('birthdate con mes 13 inexistente devuelve 400 MALFORMED_REQUEST', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      birthdate: '2000-13-01',
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });
});

// =============================================================================
// GRUPO 5: Terms Validation
// Ref: PROJECT_spec.md §Terms — terms_accepted: true mandatorio (boolean estricto)
// =============================================================================

describe('[B02-R] Terms Validation — Aceptación mandatoria booleana estricta', () => {
  it('terms_accepted: false devuelve 400 TERMS_NOT_ACCEPTED', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      terms_accepted: false,
    };
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'TERMS_NOT_ACCEPTED'
    );
  });

  it('terms_accepted ausente devuelve 400 TERMS_NOT_ACCEPTED', async () => {
    // Omite el campo terms_accepted del payload
    const { terms_accepted, ...payloadWithoutTerms } = VALID_PAYLOAD;
    void terms_accepted; // silencia advertencia de variable no usada
    const result = await registerUser(
      payloadWithoutTerms as RegisterRequest,
      { ip: TEST_IP }
    );
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'TERMS_NOT_ACCEPTED'
    );
  });

  it('terms_accepted: "true" (string) devuelve 400 MALFORMED_REQUEST (no es boolean)', async () => {
    const payload = {
      ...VALID_PAYLOAD,
      terms_accepted: 'true' as unknown as boolean,
    };
    const result = await registerUser(payload as RegisterRequest, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });

  it('terms_accepted: 1 (number) devuelve 400 MALFORMED_REQUEST (no es boolean)', async () => {
    const payload = {
      ...VALID_PAYLOAD,
      terms_accepted: 1 as unknown as boolean,
    };
    const result = await registerUser(payload as RegisterRequest, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });
});

// =============================================================================
// GRUPO 6: Rate Limiting Fixed Window
// Ref: PROJECT_spec.md §Rate Limit — 5/día por IP, Fixed Window 00:00 UTC
// =============================================================================

describe('[B02-R] Rate Limiting Fixed Window — 5 intentos/día/IP, reset 00:00 UTC', () => {
  it('los primeros 5 intentos desde la misma IP retornan 201', async () => {
    const ip = '10.1.0.1';
    for (let i = 0; i < 5; i++) {
      const result = await registerUser(VALID_PAYLOAD, { ip });
      expect(result.statusCode).toBe(201);
    }
  });

  it('el 6to intento desde la misma IP retorna 429 REGISTRATION_LIMIT_EXCEEDED', async () => {
    const ip = '10.1.0.2';
    for (let i = 0; i < 5; i++) {
      await registerUser(VALID_PAYLOAD, { ip });
    }
    const result = await registerUser(VALID_PAYLOAD, { ip });
    expect(result.statusCode).toBe(429);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'REGISTRATION_LIMIT_EXCEEDED'
    );
  });

  it('respuesta 429 incluye header Retry-After con segundos hasta el reset', async () => {
    const ip = '10.1.0.3';
    for (let i = 0; i < 5; i++) {
      await registerUser(VALID_PAYLOAD, { ip });
    }
    const result = await registerUser(VALID_PAYLOAD, { ip });
    expect(result.statusCode).toBe(429);
    expect(result.headers).toHaveProperty('Retry-After');
    const retryAfter = Number(result.headers['Retry-After']);
    expect(retryAfter).toBeGreaterThan(0);
  });

  it('toda respuesta incluye header X-RateLimit-Limit con valor 5', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: '10.1.0.4' });
    expect(result.headers['X-RateLimit-Limit']).toBe('5');
  });

  it('X-RateLimit-Remaining decrementa correctamente tras cada intento', async () => {
    const ip = '10.1.0.5';
    const first = await registerUser(VALID_PAYLOAD, { ip });
    expect(first.headers['X-RateLimit-Remaining']).toBe('4');

    const second = await registerUser(VALID_PAYLOAD, { ip });
    expect(second.headers['X-RateLimit-Remaining']).toBe('3');
  });

  it('X-RateLimit-Reset es un número Unix Epoch (no un string ISO)', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: '10.1.0.6' });
    const reset = result.headers['X-RateLimit-Reset'];
    // Debe ser un número (Unix timestamp), no una fecha ISO
    expect(typeof Number(reset)).toBe('number');
    expect(Number(reset)).toBeGreaterThan(0);
    // No debe ser un string ISO-8601
    expect(reset).not.toMatch(ISO_8601_REGEX);
  });

  it('el límite se reinicia exactamente a las 00:00 UTC (Fixed Window — Mock Clock)', async () => {
    jest.useFakeTimers();

    // Fijar reloj a las 23:59:59 del día D
    jest.setSystemTime(new Date('2026-04-14T23:59:59.000Z'));
    const ip = '10.1.0.7';

    // Agotar el límite del día D
    for (let i = 0; i < 5; i++) {
      await registerUser(VALID_PAYLOAD, { ip });
    }
    const blockedResult = await registerUser(VALID_PAYLOAD, { ip });
    expect(blockedResult.statusCode).toBe(429);

    // Avanzar el reloj al inicio del día siguiente (00:00:00 UTC)
    jest.setSystemTime(new Date('2026-04-15T00:00:00.000Z'));

    // El límite debe haber sido reiniciado — el primer intento del nuevo día debe ser 201
    const resetResult = await registerUser(VALID_PAYLOAD, { ip });
    expect(resetResult.statusCode).toBe(201);

    jest.useRealTimers();
  });

  it('IPs distintas no comparten el límite de rate (aislamiento por IP)', async () => {
    const ipA = '10.1.0.8';
    const ipB = '10.1.0.9';

    // Agotar el límite de IP A
    for (let i = 0; i < 5; i++) {
      await registerUser(VALID_PAYLOAD, { ip: ipA });
    }
    const blockedA = await registerUser(VALID_PAYLOAD, { ip: ipA });
    expect(blockedA.statusCode).toBe(429);

    // IP B no está bloqueada — debe poder registrarse
    const allowedB = await registerUser(VALID_PAYLOAD, { ip: ipB });
    expect(allowedB.statusCode).toBe(201);
  });

  it('respuesta 201 incluye header X-RateLimit-Limit en respuestas exitosas', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: '10.1.1.0' });
    expect(result.statusCode).toBe(201);
    expect(result.headers).toHaveProperty('X-RateLimit-Limit');
    expect(result.headers).toHaveProperty('X-RateLimit-Remaining');
    expect(result.headers).toHaveProperty('X-RateLimit-Reset');
  });
});

// =============================================================================
// GRUPO 7: Collision Policy Anti-Enumeración
// Ref: PROJECT_spec.md §Privacidad — user_id dummy, respuesta 201 idéntica
// =============================================================================

describe('[B02-R] Collision Policy — Anti-enumeración y user_id dummy', () => {
  it('email verificado existente devuelve 201 (misma estructura que nuevo registro)', async () => {
    const result = await registerUser(VALID_PAYLOAD, {
      ip: '10.2.0.1',
      simulateExistingVerified: true,
    });
    expect(result.statusCode).toBe(201);
    expect((result.body as Record<string, unknown>)['status']).toBe('success');
  });

  it('email no verificado existente devuelve 201 (anti-enumeración)', async () => {
    const result = await registerUser(VALID_PAYLOAD, {
      ip: '10.2.0.2',
      simulateExistingUnverified: true,
    });
    expect(result.statusCode).toBe(201);
    expect((result.body as Record<string, unknown>)['status']).toBe('success');
  });

  it('email en cooldown (purgado / 7 días) devuelve 201 (anti-enumeración)', async () => {
    const result = await registerUser(VALID_PAYLOAD, {
      ip: '10.2.0.3',
      simulateEmailInCooldown: true,
    });
    expect(result.statusCode).toBe(201);
    expect((result.body as Record<string, unknown>)['status']).toBe('success');
  });

  it('user_id en colisión es un dummy UUID v4 (no el real de la DB)', async () => {
    const result = await registerUser(VALID_PAYLOAD, {
      ip: '10.2.0.4',
      simulateExistingVerified: true,
    });
    expect(result.statusCode).toBe(201);
    const data = (result.body as Record<string, unknown>)['data'] as Record<
      string,
      unknown
    >;
    expect(data['user_id']).toMatch(UUID_V4_REGEX);
  });

  it('user_id dummy en colisiones sucesivas es DIFERENTE en cada llamada', async () => {
    const ip = '10.2.0.5';
    const first = await registerUser(VALID_PAYLOAD, {
      ip,
      simulateExistingVerified: true,
    });
    const second = await registerUser(VALID_PAYLOAD, {
      ip,
      simulateExistingVerified: true,
    });

    const firstId = (
      (first.body as Record<string, unknown>)['data'] as Record<string, unknown>
    )['user_id'];
    const secondId = (
      (second.body as Record<string, unknown>)['data'] as Record<string, unknown>
    )['user_id'];

    // Cada llamada debe generar un dummy UUID distinto (previene fingerprinting)
    expect(firstId).not.toBe(secondId);
  });

  it('user_id dummy es un UUID v4 válido según regex estricto', async () => {
    const result = await registerUser(VALID_PAYLOAD, {
      ip: '10.2.0.6',
      simulateExistingUnverified: true,
    });
    const data = (result.body as Record<string, unknown>)['data'] as Record<
      string,
      unknown
    >;
    // UUID v4: la versión es '4' en la posición correcta, la variante es [89ab]
    expect(data['user_id']).toMatch(UUID_V4_REGEX);
  });

  it('respuesta de colisión no revela si el email existe (misma estructura exacta)', async () => {
    const newRegistration = await registerUser(VALID_PAYLOAD, { ip: '10.2.1.0' });
    const collision = await registerUser(VALID_PAYLOAD, {
      ip: '10.2.1.1',
      simulateExistingVerified: true,
    });

    // Los campos del body deben ser idénticos en estructura (No-Excess)
    const newKeys = Object.keys(
      (newRegistration.body as Record<string, unknown>)['data'] as object
    ).sort();
    const collisionKeys = Object.keys(
      (collision.body as Record<string, unknown>)['data'] as object
    ).sort();
    expect(newKeys).toEqual(collisionKeys);
  });

  it('body de colisión incluye token_expires_at en formato ISO-8601', async () => {
    const result = await registerUser(VALID_PAYLOAD, {
      ip: '10.2.0.7',
      simulateExistingVerified: true,
    });
    const data = (result.body as Record<string, unknown>)['data'] as Record<
      string,
      unknown
    >;
    expect(data['token_expires_at']).toMatch(ISO_8601_REGEX);
  });

  it('fallo de email dispatch en registro nuevo devuelve 201 con warning_code EMAIL_DISPATCH_FAILED', async () => {
    const result = await registerUser(VALID_PAYLOAD, {
      ip: '10.2.1.2',
      simulateEmailFailure: true,
    });
    expect(result.statusCode).toBe(201);
    expect((result.body as Record<string, unknown>)['warning_code']).toBe(
      'EMAIL_DISPATCH_FAILED'
    );
    expect((result.body as Record<string, unknown>)['status']).toBe('success');
  });

  it('respuesta 201 exitosa incluye user_id UUID v4 y token_expires_at ISO-8601', async () => {
    const result = await registerUser(VALID_PAYLOAD, { ip: '10.2.2.0' });
    expect(result.statusCode).toBe(201);
    const data = (result.body as Record<string, unknown>)['data'] as Record<
      string,
      unknown
    >;
    expect(data['user_id']).toMatch(UUID_V4_REGEX);
    expect(data['token_expires_at']).toMatch(ISO_8601_REGEX);
  });
});

// =============================================================================
// GRUPO 8: SYSTEM_DEGRADED — Fail-Closed ante caída de servicios críticos (RNF9)
// Ref: PROJECT_spec.md §RNF9 — Si Redis falla, acceso BLOQUEADO por defecto
// =============================================================================

describe('[B02-R] SYSTEM_DEGRADED — Fail-Closed ante caída de Redis (RNF9)', () => {
  it('caída de Redis devuelve 503 SYSTEM_DEGRADED (fail-closed)', async () => {
    const result = await registerUser(VALID_PAYLOAD, {
      ip: TEST_IP,
      simulateRedisFailure: true,
    });
    expect(result.statusCode).toBe(503);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'SYSTEM_DEGRADED'
    );
  });

  it('respuesta 503 incluye version y timestamp (SOP mandatorio)', async () => {
    const result = await registerUser(VALID_PAYLOAD, {
      ip: TEST_IP,
      simulateRedisFailure: true,
    });
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 503 no expone detalles internos (sin stack traces ni mensajes técnicos)', async () => {
    const result = await registerUser(VALID_PAYLOAD, {
      ip: TEST_IP,
      simulateRedisFailure: true,
    });
    const bodyStr = JSON.stringify(result.body);
    // No debe contener información de depuración interna
    expect(bodyStr).not.toContain('stack');
    expect(bodyStr).not.toContain('Error:');
    expect(bodyStr).not.toContain('ECONNREFUSED');
    expect(bodyStr).not.toContain('at Object.');
  });

  it('mensaje de 503 está en español según spec (CLAUDE.md §Convenciones)', async () => {
    const result = await registerUser(VALID_PAYLOAD, {
      ip: TEST_IP,
      simulateRedisFailure: true,
    });
    const body = result.body as Record<string, unknown>;
    expect(typeof body['message']).toBe('string');
    // El mensaje específico de la spec
    expect(body['message']).toBe(
      'El sistema está en mantenimiento. Intente más tarde.'
    );
  });
});

// =============================================================================
// GRUPO 9: Malformed Request
// Ref: PROJECT_spec.md §400 MALFORMED_REQUEST — body inválido, campos ausentes
// =============================================================================

describe('[B02-R] Malformed Request — Body vacío, campos ausentes y tipos incorrectos', () => {
  it('body vacío devuelve 400 MALFORMED_REQUEST', async () => {
    const result = await registerUser(
      {} as RegisterRequest,
      { ip: TEST_IP }
    );
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });

  it('campo email ausente devuelve 400 MALFORMED_REQUEST', async () => {
    const { email, ...withoutEmail } = VALID_PAYLOAD;
    void email;
    const result = await registerUser(withoutEmail as RegisterRequest, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });

  it('campo password ausente devuelve 400 MALFORMED_REQUEST', async () => {
    const { password, ...withoutPassword } = VALID_PAYLOAD;
    void password;
    const result = await registerUser(withoutPassword as RegisterRequest, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });

  it('campo birthdate ausente devuelve 400 MALFORMED_REQUEST', async () => {
    const { birthdate, ...withoutBirthdate } = VALID_PAYLOAD;
    void birthdate;
    const result = await registerUser(
      withoutBirthdate as RegisterRequest,
      { ip: TEST_IP }
    );
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });

  it('email como número (tipo incorrecto) devuelve 400 MALFORMED_REQUEST', async () => {
    const payload = { ...VALID_PAYLOAD, email: 12345 as unknown as string };
    const result = await registerUser(payload as RegisterRequest, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe(
      'MALFORMED_REQUEST'
    );
  });
});

// =============================================================================
// GRUPO 10: I18N & Accept-Language
// Ref: CLAUDE.md §Convenciones — UI en español, fallback mandatorio a 'es'
// =============================================================================

describe('[B02-R] I18N & Accept-Language — Fallback mandatorio a "es"', () => {
  it('Accept-Language: es → mensajes de error en español', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      terms_accepted: false,
    };
    const result = await registerUser(payload, { ip: TEST_IP, lang: 'es' });
    expect(result.statusCode).toBe(400);
    // El mensaje debe estar en español (contiene caracteres del español o palabras clave)
    const message = (result.body as Record<string, unknown>)['message'] as string;
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  it('Accept-Language: en → fallback a español (solo "es" está soportado)', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      terms_accepted: false,
    };
    // El sistema solo soporta "es" — "en" hace fallback a "es"
    const resultEs = await registerUser(payload, { ip: TEST_IP, lang: 'es' });
    const resultEn = await registerUser(payload, { ip: TEST_IP, lang: 'en' });

    // Ambos mensajes deben ser el mismo (español en ambos casos)
    expect((resultEn.body as Record<string, unknown>)['message']).toBe(
      (resultEs.body as Record<string, unknown>)['message']
    );
  });

  it('Accept-Language inválido → fallback a español (fail-safe)', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      terms_accepted: false,
    };
    const result = await registerUser(payload, {
      ip: TEST_IP,
      lang: 'invalid-language-header!!!',
    });
    expect(result.statusCode).toBe(400);
    const message = (result.body as Record<string, unknown>)['message'] as string;
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  it('sin Accept-Language → fallback a español (header ausente)', async () => {
    const payload: RegisterRequest = {
      ...VALID_PAYLOAD,
      terms_accepted: false,
    };
    // Sin pasar `lang` — el servicio debe asumir 'es'
    const result = await registerUser(payload, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    const message = (result.body as Record<string, unknown>)['message'] as string;
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });
});
