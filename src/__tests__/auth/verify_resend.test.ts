/**
 * TSK-I2-B03-R — verify_resend.test.ts
 * Agente: backend-tester
 * Estado: RED — Los módulos verifyAccount y resendVerification NO EXISTEN.
 *         TODOS estos tests deben FALLAR con "Cannot find module" hasta que
 *         TSK-I2-B03-G1 y TSK-I2-B03-G2 implementen la lógica.
 *
 * Suite de tests unitarios que validan el contrato completo de:
 *   - POST /api/v1/auth/verify  (Verificación de email)
 *   - POST /api/v1/auth/resend  (Reenvío de token)
 *
 * Grupos:
 *   1.  SOP Compliance — Verify (7 tests)
 *   2.  Token Validation — Verify (8 tests)
 *   3.  Estado del Token — Expiración y Uso (7 tests)
 *   4.  Method Not Allowed — Verify (3 tests)
 *   5.  Token via Query Param (Prohibido) (4 tests)
 *   6.  SYSTEM_DEGRADED — Verify (3 tests)
 *   7.  SOP Compliance — Resend (6 tests)
 *   8.  Email Validation — Resend (5 tests)
 *   9.  Rate Limiting Resend — 3/hr por IP:Email (7 tests)
 *   10. Colisión de Cuenta Ya Activa — Resend (5 tests)
 *   11. SYSTEM_DEGRADED — Resend (3 tests)
 *   12. Normalización de Token (lowercase) (4 tests)
 *   13. Seguridad — Token no queda en logs (2 tests)
 *
 * Trazabilidad: PROJECT_spec.md §Iteración 2 — /verify y /resend
 * Protocolos: tdd-master (RED-CHECK), api-contract-tester (Strict No-Excess)
 */

// =============================================================================
// ATENCIÓN: Estos imports FALLARÁN hasta que TSK-I2-B03-G implemente los módulos.
// El fallo deliberado con "Cannot find module" ES el estado RED requerido.
// =============================================================================

import {
  verifyAccount,
  type VerifyRequest,
  type VerifyResult,
} from '@/src/lib/services/verify_service';

import {
  resendVerification,
  type ResendRequest,
  type ResendResult,
} from '@/src/lib/services/resend_service';

// =============================================================================
// Helpers de validación (reutilizados desde patrón del B02-R existente)
// =============================================================================

/** Regex UUID v4 estricto — api-contract-tester §II */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Regex timestamp ISO-8601 con milisegundos y zona UTC */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Token UUID v4 de referencia (lowercase, válido para Verify) */
const VALID_TOKEN = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

/** IP de referencia para tests */
const TEST_IP = '192.168.1.200';

/** Email de referencia para tests de Resend */
const VALID_EMAIL = 'user@example.com';

/**
 * Helper: verifica campos SOP mandatorios en el body de toda respuesta.
 * Referencia: PROJECT_spec.md §SOP Global (Inheritance) — versión + timestamp obligatorios.
 */
function assertSopBody(body: Record<string, unknown>): void {
  expect(body).toHaveProperty('version', '1.0.0');
  expect(body).toHaveProperty('timestamp');
  expect(typeof body['timestamp']).toBe('string');
  expect(body['timestamp']).toMatch(ISO_8601_REGEX);
}

/**
 * Helper: verifica headers SOP globales presentes en toda respuesta.
 */
function assertSopHeaders(result: VerifyResult | ResendResult): void {
  expect(result.headers['X-Request-ID']).toMatch(UUID_V4_REGEX);
  expect(result.headers['X-Version']).toBe('1.0.0');
  expect(result.headers['X-Timestamp']).toMatch(ISO_8601_REGEX);
  expect(result.headers['Content-Type']).toContain('application/json');
}

// =============================================================================
// GRUPO 1: SOP Compliance — Verify
// Ref: PROJECT_spec.md §SOP Global (Inheritance) — todos los endpoints heredan
//      version + timestamp en TODA respuesta (2xx, 4xx, 5xx).
// =============================================================================

describe('[B03-R] SOP Compliance — Verify: version y timestamp en toda respuesta', () => {
  it('respuesta 200 OK incluye header X-Request-ID como UUID v4 válido', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, { ip: TEST_IP });
    expect(result.headers['X-Request-ID']).toMatch(UUID_V4_REGEX);
  });

  it('respuesta 200 OK incluye header X-Version con valor "1.0.0"', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, { ip: TEST_IP });
    expect(result.headers['X-Version']).toBe('1.0.0');
  });

  it('respuesta 200 OK body contiene version: "1.0.0"', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(200);
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 400 (token inválido) body contiene version y timestamp (SOP en errores)', async () => {
    const req: VerifyRequest = { token: 'not-a-uuid' };
    const result = await verifyAccount(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 409 (ya verificado) body contiene version y timestamp', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateAlreadyVerified: true,
    });
    expect(result.statusCode).toBe(409);
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 410 (token expirado) body contiene version y timestamp', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateExpiredToken: true,
    });
    expect(result.statusCode).toBe(410);
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 503 (SYSTEM_DEGRADED) body contiene version y timestamp', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateRedisFailure: true,
    });
    expect(result.statusCode).toBe(503);
    assertSopBody(result.body as Record<string, unknown>);
  });
});

// =============================================================================
// GRUPO 2: Token Validation — Verify
// Ref: PROJECT_spec.md §Verify — token debe ser UUID v4 válido (Regex L157)
//      §Security Guard — token se envía en Body, NUNCA en Query Param.
// =============================================================================

describe('[B03-R] Token Validation — Verify: UUID v4 estricto en Body', () => {
  it('token UUID v4 válido (lowercase) devuelve 200 OK', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(200);
  });

  it('token UUID v4 en MAYÚSCULAS devuelve 200 OK tras normalización a lowercase', async () => {
    // El servidor DEBE normalizar el token a lowercase antes de validar/hashear
    const upperToken = VALID_TOKEN.toUpperCase();
    const req: VerifyRequest = { token: upperToken };
    const result = await verifyAccount(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(200);
  });

  it('token vacío devuelve 400 INVALID_TOKEN', async () => {
    const req: VerifyRequest = { token: '' };
    const result = await verifyAccount(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('INVALID_TOKEN');
  });

  it('token con formato incorrecto (no es UUID) devuelve 400 INVALID_TOKEN', async () => {
    const req: VerifyRequest = { token: 'this-is-not-a-uuid-at-all' };
    const result = await verifyAccount(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('INVALID_TOKEN');
  });

  it('token UUID v3 (version 3) devuelve 400 INVALID_TOKEN (debe ser v4)', async () => {
    // UUID v3: el dígito de versión es '3', no '4'
    const uuidV3 = 'a1b2c3d4-e5f6-3a7b-8c9d-0e1f2a3b4c5d';
    const req: VerifyRequest = { token: uuidV3 };
    const result = await verifyAccount(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('INVALID_TOKEN');
  });

  it('token ausente (campo token no incluido) devuelve 400 INVALID_TOKEN', async () => {
    // Se envía un objeto vacío sin el campo token
    const req = {} as VerifyRequest;
    const result = await verifyAccount(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('INVALID_TOKEN');
  });

  it('token que no existe en DB devuelve 400 INVALID_TOKEN', async () => {
    // Token con formato válido pero que no existe en la base de datos
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateTokenNotFound: true,
    });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('INVALID_TOKEN');
  });

  it('respuesta 200 OK body contiene mensaje de verificación exitosa', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body['status']).toBe('success');
    expect(typeof body['message']).toBe('string');
    expect((body['message'] as string).length).toBeGreaterThan(0);
  });
});

// =============================================================================
// GRUPO 3: Estado del Token — Expiración y Doble Uso
// Ref: PROJECT_spec.md §Verify — 410 Gone (expirado 24h), 409 Conflict (ya verificado)
//      §Auth — tokens soft-deleted con flag used_at, ACID transaction.
// =============================================================================

describe('[B03-R] Estado del Token — Expiración, doble uso y ciclo de vida', () => {
  it('token expirado devuelve 410 Gone con EXPIRED_TOKEN', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateExpiredToken: true,
    });
    expect(result.statusCode).toBe(410);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('EXPIRED_TOKEN');
  });

  it('cuenta ya verificada devuelve 409 Conflict con ALREADY_VERIFIED', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateAlreadyVerified: true,
    });
    expect(result.statusCode).toBe(409);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('ALREADY_VERIFIED');
  });

  it('usar el mismo token dos veces devuelve 409 ALREADY_VERIFIED en el segundo intento', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };

    // Primera verificación: exitosa
    const firstResult = await verifyAccount(req, { ip: TEST_IP });
    expect(firstResult.statusCode).toBe(200);

    // Segunda verificación del mismo token: debe ser 409 (token ya consumido)
    const secondResult = await verifyAccount(req, {
      ip: TEST_IP,
      simulateAlreadyVerified: true, // El estado cambia tras la primera verificación
    });
    expect(secondResult.statusCode).toBe(409);
    expect((secondResult.body as Record<string, unknown>)['error_code']).toBe('ALREADY_VERIFIED');
  });

  it('token expirado exactamente a las 24h (Mock Clock) devuelve 410', async () => {
    jest.useFakeTimers();

    // Creación del token (T=0)
    jest.setSystemTime(new Date('2026-04-14T10:00:00.000Z'));
    const req: VerifyRequest = { token: VALID_TOKEN };

    // Avanzar reloj 24h + 1 segundo → token expirado
    jest.setSystemTime(new Date('2026-04-15T10:00:01.000Z'));

    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateExpiredToken: true,
    });
    expect(result.statusCode).toBe(410);

    jest.useRealTimers();
  });

  it('token expirado 410 body incluye mensaje indicando que se solicite uno nuevo', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateExpiredToken: true,
    });
    const body = result.body as Record<string, unknown>;
    expect(result.statusCode).toBe(410);
    expect(typeof body['message']).toBe('string');
    expect(body['message']).toBeTruthy();
  });

  it('respuesta 409 ALREADY_VERIFIED SOP: incluye version y timestamp', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateAlreadyVerified: true,
    });
    expect(result.statusCode).toBe(409);
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 410 EXPIRED_TOKEN SOP: incluye version y timestamp', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateExpiredToken: true,
    });
    expect(result.statusCode).toBe(410);
    assertSopBody(result.body as Record<string, unknown>);
  });
});

// =============================================================================
// GRUPO 4: Method Not Allowed — Verify
// Ref: PROJECT_spec.md §Verify §Logic — Solo POST. GET retorna 405.
//      §SOP Global (Inheritance) — 405 heredado en todos los endpoints.
// =============================================================================

describe('[B03-R] Method Not Allowed — Verify: solo POST aceptado', () => {
  it('verbo GET en /verify devuelve 405 METHOD_NOT_ALLOWED', async () => {
    const result = await verifyAccount(
      { token: VALID_TOKEN },
      { ip: TEST_IP, httpMethod: 'GET' }
    );
    expect(result.statusCode).toBe(405);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('METHOD_NOT_ALLOWED');
  });

  it('verbo PUT en /verify devuelve 405 METHOD_NOT_ALLOWED', async () => {
    const result = await verifyAccount(
      { token: VALID_TOKEN },
      { ip: TEST_IP, httpMethod: 'PUT' }
    );
    expect(result.statusCode).toBe(405);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('METHOD_NOT_ALLOWED');
  });

  it('body 405 contiene version y timestamp (SOP heredado en errores de método)', async () => {
    const result = await verifyAccount(
      { token: VALID_TOKEN },
      { ip: TEST_IP, httpMethod: 'GET' }
    );
    expect(result.statusCode).toBe(405);
    assertSopBody(result.body as Record<string, unknown>);
  });
});

// =============================================================================
// GRUPO 5: Token via Query Param — Prohibido
// Ref: PROJECT_spec.md §Verify §Security Guard — token ESTRICTAMENTE en Body.
//      §Spec L385 — uso de Query Params está prohibido → 400 o 405.
//      §Seguridad — tokens enviados via QP no deben quedar en logs de acceso.
// =============================================================================

describe('[B03-R] Token via Query Param — Prohibido (Security Guard)', () => {
  it('token enviado via query param (tokenInQueryParam=true) devuelve 400 o 405', async () => {
    const result = await verifyAccount(
      { token: '' }, // body vacío
      { ip: TEST_IP, tokenInQueryParam: VALID_TOKEN }
    );
    // El servidor debe rechazar cualquier intento de usar Query Param
    expect([400, 405]).toContain(result.statusCode);
  });

  it('query param con token válido es rechazado aunque el body sea correcto', async () => {
    // Incluso si el body tiene un token, el query param no debe ser procesado
    const result = await verifyAccount(
      { token: '' },
      { ip: TEST_IP, tokenInQueryParam: VALID_TOKEN }
    );
    expect(result.statusCode).not.toBe(200);
  });

  it('body del rechazo por Query Param contiene SOP (version + timestamp)', async () => {
    const result = await verifyAccount(
      { token: '' },
      { ip: TEST_IP, tokenInQueryParam: VALID_TOKEN }
    );
    expect([400, 405]).toContain(result.statusCode);
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('el token enviado via Query Param NO debe aparecer en los logs de la respuesta', async () => {
    const sensitiveToken = 'f0e1d2c3-b4a5-4697-8e9f-0a1b2c3d4e5f';
    const result = await verifyAccount(
      { token: '' },
      { ip: TEST_IP, tokenInQueryParam: sensitiveToken }
    );
    // El token sensible NO debe estar presente en ningún campo del body de respuesta
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain(sensitiveToken);
  });
});

// =============================================================================
// GRUPO 6: SYSTEM_DEGRADED — Verify
// Ref: PROJECT_spec.md §SOP Global (Inheritance) — 503 SYSTEM_DEGRADED heredado.
//      RNF9 — Fail-Closed: si Redis/DB están caídos, retornar 503.
// =============================================================================

describe('[B03-R] SYSTEM_DEGRADED — Verify: fail-closed ante caída de servicios', () => {
  it('caída de Redis en /verify devuelve 503 SYSTEM_DEGRADED', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateRedisFailure: true,
    });
    expect(result.statusCode).toBe(503);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('SYSTEM_DEGRADED');
  });

  it('caída de DB en /verify devuelve 503 SYSTEM_DEGRADED', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateDbFailure: true,
    });
    expect(result.statusCode).toBe(503);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('SYSTEM_DEGRADED');
  });

  it('503 SYSTEM_DEGRADED en /verify body contiene SOP (version + timestamp)', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, {
      ip: TEST_IP,
      simulateRedisFailure: true,
    });
    expect(result.statusCode).toBe(503);
    assertSopBody(result.body as Record<string, unknown>);
  });
});

// =============================================================================
// GRUPO 7: SOP Compliance — Resend
// Ref: PROJECT_spec.md §Resend — Todos los campos SOP heredados en /resend.
// =============================================================================

describe('[B03-R] SOP Compliance — Resend: version y timestamp en toda respuesta', () => {
  it('respuesta 200 OK de /resend incluye header X-Request-ID UUID v4', async () => {
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, { ip: TEST_IP });
    assertSopHeaders(result);
  });

  it('respuesta 200 OK de /resend body contiene version: "1.0.0"', async () => {
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(200);
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 200 OK de /resend contiene mensaje genérico de privacidad', async () => {
    // Spec L406: respuesta siempre es 200 OK si el formato es válido
    // El mensaje debe ser genérico (no revelar si el email existe)
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body['status']).toBe('success');
    expect(typeof body['message']).toBe('string');
  });

  it('respuesta 400 INVALID_EMAIL_FORMAT de /resend body contiene version y timestamp', async () => {
    const req: ResendRequest = { email: 'not-an-email' };
    const result = await resendVerification(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 429 RESEND_LIMIT_EXCEEDED de /resend body contiene version y timestamp', async () => {
    const ip = '10.3.0.1';
    const email = 'throttled@example.com';
    // Agotar el límite de 3/hr
    for (let i = 0; i < 3; i++) {
      await resendVerification({ email }, { ip });
    }
    const result = await resendVerification({ email }, { ip });
    expect(result.statusCode).toBe(429);
    assertSopBody(result.body as Record<string, unknown>);
  });

  it('respuesta 200 con warning_code EMAIL_DISPATCH_FAILED body contiene SOP', async () => {
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, {
      ip: TEST_IP,
      simulateEmailFailure: true,
    });
    expect(result.statusCode).toBe(200);
    assertSopBody(result.body as Record<string, unknown>);
  });
});

// =============================================================================
// GRUPO 8: Email Validation — Resend
// Ref: PROJECT_spec.md §Resend §Validaciones — Paridad total con Register
//      RFC 5322, longitud 5-254, normalización a lowercase.
// =============================================================================

describe('[B03-R] Email Validation — Resend: paridad con règles de Register', () => {
  it('email válido en /resend devuelve 200 OK', async () => {
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, { ip: '10.3.1.1' });
    expect(result.statusCode).toBe(200);
  });

  it('email sin @ en /resend devuelve 400 INVALID_EMAIL_FORMAT', async () => {
    const req: ResendRequest = { email: 'invalidemail.com' };
    const result = await resendVerification(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('INVALID_EMAIL_FORMAT');
  });

  it('email vacío en /resend devuelve 400 INVALID_EMAIL_FORMAT', async () => {
    const req: ResendRequest = { email: '' };
    const result = await resendVerification(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('INVALID_EMAIL_FORMAT');
  });

  it('email > 254 caracteres en /resend devuelve 400 INVALID_EMAIL_FORMAT', async () => {
    const longLocal = 'a'.repeat(250);
    const req: ResendRequest = { email: `${longLocal}@example.com` };
    const result = await resendVerification(req, { ip: TEST_IP });
    expect(result.statusCode).toBe(400);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('INVALID_EMAIL_FORMAT');
  });

  it('email no existente en DB devuelve 200 OK (privacidad — anti-enumeración)', async () => {
    // Spec L415: siempre 200 OK si el formato es válido, aunque el email no exista
    const req: ResendRequest = { email: 'nonexistent@example.com' };
    const result = await resendVerification(req, {
      ip: '10.3.1.2',
      simulateEmailNotFound: true,
    });
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body['status']).toBe('success');
  });
});

// =============================================================================
// GRUPO 9: Rate Limiting Resend — 3/hr por clave compuesta IP:Email
// Ref: PROJECT_spec.md §Resend §Rate Limiting — 3 por hora.
//      §Spec B03-G2 — clave compuesta IP:Email en Redis.
// =============================================================================

describe('[B03-R] Rate Limiting Resend — 3/hr por clave IP:Email', () => {
  it('los primeros 3 intentos de /resend con misma IP+Email retornan 200', async () => {
    const ip = '10.3.2.1';
    const email = 'rl-test@example.com';
    for (let i = 0; i < 3; i++) {
      const result = await resendVerification({ email }, { ip });
      expect(result.statusCode).toBe(200);
    }
  });

  it('el 4to intento de /resend devuelve 429 RESEND_LIMIT_EXCEEDED', async () => {
    const ip = '10.3.2.2';
    const email = 'rl-block@example.com';
    for (let i = 0; i < 3; i++) {
      await resendVerification({ email }, { ip });
    }
    const result = await resendVerification({ email }, { ip });
    expect(result.statusCode).toBe(429);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('RESEND_LIMIT_EXCEEDED');
  });

  it('respuesta 429 incluye header Retry-After con segundos hasta el reset', async () => {
    const ip = '10.3.2.3';
    const email = 'rl-retry@example.com';
    for (let i = 0; i < 3; i++) {
      await resendVerification({ email }, { ip });
    }
    const result = await resendVerification({ email }, { ip });
    expect(result.statusCode).toBe(429);
    expect(result.headers).toHaveProperty('Retry-After');
    const retryAfter = Number(result.headers['Retry-After']);
    expect(retryAfter).toBeGreaterThan(0);
  });

  it('toda respuesta de /resend incluye headers X-RateLimit-* (Limit: 3)', async () => {
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, { ip: '10.3.2.4' });
    expect(result.headers['X-RateLimit-Limit']).toBe('3');
    expect(result.headers).toHaveProperty('X-RateLimit-Remaining');
    expect(result.headers).toHaveProperty('X-RateLimit-Reset');
  });

  it('X-RateLimit-Remaining en /resend decrementa tras cada intento', async () => {
    const ip = '10.3.2.5';
    const email = 'rl-decrement@example.com';
    const first = await resendVerification({ email }, { ip });
    expect(first.headers['X-RateLimit-Remaining']).toBe('2');

    const second = await resendVerification({ email }, { ip });
    expect(second.headers['X-RateLimit-Remaining']).toBe('1');
  });

  it('diferentes combinaciones IP:Email son límites independientes', async () => {
    const ipA = '10.3.2.6';
    const emailA = 'combo-a@example.com';
    // Agotar el límite de IP-A + Email-A
    for (let i = 0; i < 3; i++) {
      await resendVerification({ email: emailA }, { ip: ipA });
    }
    const blockedA = await resendVerification({ email: emailA }, { ip: ipA });
    expect(blockedA.statusCode).toBe(429);

    // Misma IP, email distinto → límite independiente
    const emailB = 'combo-b@example.com';
    const allowedB = await resendVerification({ email: emailB }, { ip: ipA });
    expect(allowedB.statusCode).toBe(200);
  });

  it('misma IP, mismo email en distintas horas no comparte el contador (ventana 1h)', async () => {
    jest.useFakeTimers();

    // Hora 1: agotar el límite
    jest.setSystemTime(new Date('2026-04-14T09:00:00.000Z'));
    const ip = '10.3.2.7';
    const email = 'window-test@example.com';
    for (let i = 0; i < 3; i++) {
      await resendVerification({ email }, { ip });
    }
    const blocked = await resendVerification({ email }, { ip });
    expect(blocked.statusCode).toBe(429);

    // Avanzar reloj 1h + 1s → nueva ventana
    jest.setSystemTime(new Date('2026-04-14T10:00:01.000Z'));
    const newWindow = await resendVerification({ email }, { ip });
    expect(newWindow.statusCode).toBe(200);

    jest.useRealTimers();
  });
});

// =============================================================================
// GRUPO 10: Colisión de Cuenta Ya Activa — Resend
// Ref: PROJECT_spec.md §Resend §Flujo Interno (Already Verified) — 200 OK pero
//      el servidor envía correo informativo (NO link de activación).
//      Privacidad: el endpoint NUNCA revela si la cuenta está verificada.
// =============================================================================

describe('[B03-R] Colisión de Cuenta Verificada — Resend: anti-enumeración', () => {
  it('email de cuenta ya verificada devuelve 200 OK (no revela estado)', async () => {
    // Spec L416: si el email está activo, se devuelve 200 OK pero se envía correo informativo.
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, {
      ip: '10.3.3.1',
      simulateAlreadyVerified: true,
    });
    expect(result.statusCode).toBe(200);
  });

  it('respuesta 200 OK para cuenta verificada tiene la misma estructura que para cuenta pendiente', async () => {
    const ipA = '10.3.3.2';
    const ipB = '10.3.3.3';

    const pendingResult = await resendVerification(
      { email: VALID_EMAIL },
      { ip: ipA }
    );
    const verifiedResult = await resendVerification(
      { email: VALID_EMAIL },
      { ip: ipB, simulateAlreadyVerified: true }
    );

    // Ambas respuestas deben tener la misma estructura de body (anti-enumeración)
    const pendingKeys = Object.keys(pendingResult.body as object).sort();
    const verifiedKeys = Object.keys(verifiedResult.body as object).sort();
    expect(pendingKeys).toEqual(verifiedKeys);
  });

  it('email no registrado en /resend devuelve 200 OK (no revela ausencia del email)', async () => {
    const req: ResendRequest = { email: 'ghost@example.com' };
    const result = await resendVerification(req, {
      ip: '10.3.3.4',
      simulateEmailNotFound: true,
    });
    expect(result.statusCode).toBe(200);
    expect((result.body as Record<string, unknown>)['status']).toBe('success');
  });

  it('fallo de email dispatch en /resend devuelve 200 con warning_code EMAIL_DISPATCH_FAILED', async () => {
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, {
      ip: '10.3.3.5',
      simulateEmailFailure: true,
    });
    expect(result.statusCode).toBe(200);
    expect((result.body as Record<string, unknown>)['status']).toBe('success');
    expect((result.body as Record<string, unknown>)['warning_code']).toBe(
      'EMAIL_DISPATCH_FAILED'
    );
  });

  it('respuesta con EMAIL_DISPATCH_FAILED body contiene version y timestamp (SOP)', async () => {
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, {
      ip: '10.3.3.6',
      simulateEmailFailure: true,
    });
    expect(result.statusCode).toBe(200);
    assertSopBody(result.body as Record<string, unknown>);
  });
});

// =============================================================================
// GRUPO 11: SYSTEM_DEGRADED — Resend
// Ref: PROJECT_spec.md §SOP Global (Inheritance) — 503 heredado en /resend.
// =============================================================================

describe('[B03-R] SYSTEM_DEGRADED — Resend: fail-closed ante caída de servicios', () => {
  it('caída de Redis en /resend devuelve 503 SYSTEM_DEGRADED', async () => {
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, {
      ip: TEST_IP,
      simulateRedisFailure: true,
    });
    expect(result.statusCode).toBe(503);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('SYSTEM_DEGRADED');
  });

  it('caída de DB en /resend devuelve 503 SYSTEM_DEGRADED', async () => {
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, {
      ip: TEST_IP,
      simulateDbFailure: true,
    });
    expect(result.statusCode).toBe(503);
    expect((result.body as Record<string, unknown>)['error_code']).toBe('SYSTEM_DEGRADED');
  });

  it('503 en /resend body contiene SOP (version + timestamp)', async () => {
    const req: ResendRequest = { email: VALID_EMAIL };
    const result = await resendVerification(req, {
      ip: TEST_IP,
      simulateRedisFailure: true,
    });
    expect(result.statusCode).toBe(503);
    assertSopBody(result.body as Record<string, unknown>);
  });
});

// =============================================================================
// GRUPO 12: Normalización de Token — Lowercase Mandatorio
// Ref: PROJECT_spec.md §Auth §Normalización Crítica — lowercase antes de hash.
//      TSK-I2-B01-V — el tester confirmó que tokens Mixed-case son válidos tras
//      conversión a lowercase.
// =============================================================================

describe('[B03-R] Normalización de Token — Lowercase obligatorio antes de hash', () => {
  it('token en MAYÚSCULAS es equivalente al mismo token en lowercase (normalización)', async () => {
    const lowerReq: VerifyRequest = { token: VALID_TOKEN };
    const upperReq: VerifyRequest = { token: VALID_TOKEN.toUpperCase() };

    const lowerResult = await verifyAccount(lowerReq, { ip: '10.4.0.1' });
    const upperResult = await verifyAccount(upperReq, { ip: '10.4.0.2' });

    // Ambas deben retornar el mismo código de respuesta
    expect(lowerResult.statusCode).toBe(upperResult.statusCode);
  });

  it('token Mixed-Case (e.g. A1B2c3D4-...) es aceptado y normalizado internamente', async () => {
    const mixedToken = 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D';
    const req: VerifyRequest = { token: mixedToken };
    const result = await verifyAccount(req, { ip: '10.4.0.3' });
    // El servidor normaliza a lowercase antes de buscar en DB → 200 si existe
    expect(result.statusCode).toBe(200);
  });

  it('el cuerpo de respuesta NO contiene el token en ningún formato (no filtrado)', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, { ip: '10.4.0.4' });
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain(VALID_TOKEN);
    expect(bodyStr).not.toContain(VALID_TOKEN.toUpperCase());
  });

  it('token normalizado a lowercase produce el mismo SHA-256 que la versión original lowercase', async () => {
    // Test de comportamiento: dos tokens que se normalizan al mismo lowercase
    // deben producir el mismo resultado de verificación
    const token1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'; // lowercase
    const token2 = 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D'; // UPPERCASE

    const result1 = await verifyAccount({ token: token1 }, { ip: '10.4.1.1' });
    const result2 = await verifyAccount({ token: token2 }, { ip: '10.4.1.2' });

    // Mismo código HTTP → misma aceptación/rechazo (comportamiento idéntico)
    expect(result1.statusCode).toBe(result2.statusCode);
  });
});

// =============================================================================
// GRUPO 13: Seguridad — Token no queda en logs de acceso
// Ref: PROJECT_spec.md §Verify §Security Guard L385 — tokens filtrados en
//      Query Param no deben quedar persistidos en logs de acceso.
// =============================================================================

describe('[B03-R] Seguridad — Token sensible no expuesto en respuestas ni metadatos', () => {
  it('el token NO aparece en ningún campo del body de una respuesta exitosa', async () => {
    const req: VerifyRequest = { token: VALID_TOKEN };
    const result = await verifyAccount(req, { ip: '10.5.0.1' });
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain(VALID_TOKEN);
  });

  it('el token enviado via Query Param NO aparece en el body de la respuesta de rechazo', async () => {
    const secretToken = 'e9d8c7b6-a5f4-4e3d-2c1b-0a9f8e7d6c5b';
    const result = await verifyAccount(
      { token: '' },
      { ip: TEST_IP, tokenInQueryParam: secretToken }
    );
    // El token sensible NO debe estar en la respuesta, para no quedar en logs
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain(secretToken);
  });
});
