/**
 * TSK-I2-B02-V — register_privacy_val.test.ts
 * Agente: backend-tester
 * Estado: VAL (el módulo ya está implementado — todos los tests deben pasar en GREEN)
 *
 * Suite de VALIDACION del Bloque 9 de la Iteración 2.
 * Cubre: anti-enumeración, UUID dummy rotativo, headers de rate limit (Unix Epoch),
 * inmutabilidad de idioma (error_code inglés / message español), warning_code
 * EMAIL_DISPATCH_FAILED y compliance SOP en todos los status codes.
 *
 * Trazabilidad: PROJECT_spec.md §Iteración 2 — Contratos técnicos de register_service.
 * Protocolos aplicados: tdd-master (VAL), api-contract-tester (Strict No-Excess),
 * infra-security-tester (penetration test de anti-enumeración).
 */

import {
  registerUser,
  type RegisterRequest,
  type RegisterResult,
} from '@/src/lib/services/register_service';

// =============================================================================
// HELPERS & CONSTANTES GLOBALES
// =============================================================================

/** Regex UUID v4 estricto — RFC 4122 §4.4 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** ISO-8601 con milisegundos y zona horaria UTC obligatoria */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Payload base válido — adulto, contraseña fuerte, términos aceptados */
const VALID_PAYLOAD: RegisterRequest = {
  email: 'val@example.com',
  password: 'Password123!',
  birthdate: '2000-01-01',
  terms_accepted: true,
};

/** IP fija para tests que no necesitan aislar el rate limit entre sí */
const TEST_IP = '10.0.0.1';

/**
 * Extrae el body casteado para facilitar aserciones.
 * El tipo `unknown` del body es intencional en el contrato público —
 * en los tests lo casteamos para poder inspeccionar los campos.
 */
function body(result: RegisterResult): Record<string, unknown> {
  return result.body as Record<string, unknown>;
}

/**
 * Extrae el objeto `data` del body.
 */
function dataOf(result: RegisterResult): Record<string, unknown> {
  return (body(result)['data'] as Record<string, unknown>) ?? {};
}

// =============================================================================
// GRUPO 1 — Penetration Test: Anti-enumeración de usuarios (12 tests)
// Un atacante NO puede distinguir entre un email nuevo y uno existente.
// Ref: PROJECT_spec.md §Política anti-enumeración (colisiones → 201 dummy)
// =============================================================================

describe('[B02-V] Anti-enumeración — Penetration Test de privacidad de usuarios', () => {
  /**
   * NOTA DE SEGURIDAD (no testeable directamente):
   * La igualdad de tiempo de respuesta entre registro nuevo y colisión es un
   * invariante de diseño que no se verifica en este test porque depende del
   * entorno de ejecución. El contrato garantiza que la lógica de colisión
   * no realiza operaciones adicionales de red que aumenten la latencia observable.
   */

  it('nuevo email devuelve statusCode 201', async () => {
    const result = await registerUser({ ...VALID_PAYLOAD }, { ip: TEST_IP });
    expect(result.statusCode).toBe(201);
  });

  it('email verificado (colisión) devuelve statusCode 201 — idéntico al nuevo', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'verified@example.com' },
      { ip: TEST_IP, simulateExistingVerified: true }
    );
    expect(result.statusCode).toBe(201);
  });

  it('email no verificado (colisión) devuelve statusCode 201 — idéntico al nuevo', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'unverified@example.com' },
      { ip: TEST_IP, simulateExistingUnverified: true }
    );
    expect(result.statusCode).toBe(201);
  });

  it('email en cooldown devuelve statusCode 201 — idéntico al nuevo', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'cooldown@example.com' },
      { ip: TEST_IP, simulateEmailInCooldown: true }
    );
    expect(result.statusCode).toBe(201);
  });

  it('estructura del body (claves) es idéntica entre nuevo y colisión verificada (No-Excess)', async () => {
    const newReg = await registerUser(
      { ...VALID_PAYLOAD, email: 'new1@example.com' },
      { ip: '10.0.1.1' }
    );
    const collision = await registerUser(
      { ...VALID_PAYLOAD, email: 'col1@example.com' },
      { ip: '10.0.1.2', simulateExistingVerified: true }
    );

    const newKeys = Object.keys(body(newReg)).sort();
    const colKeys = Object.keys(body(collision)).sort();
    expect(colKeys).toEqual(newKeys);
  });

  it('el body NO contiene campo extra "exists" que revele si el email existe', async () => {
    const collision = await registerUser(
      { ...VALID_PAYLOAD, email: 'noleak@example.com' },
      { ip: TEST_IP, simulateExistingVerified: true }
    );
    expect(body(collision)).not.toHaveProperty('exists');
  });

  it('el body NO contiene campo "is_new_user" en ninguna variante de colisión', async () => {
    const verified = await registerUser(
      { ...VALID_PAYLOAD, email: 'nofield1@example.com' },
      { ip: '10.0.2.1', simulateExistingVerified: true }
    );
    const unverified = await registerUser(
      { ...VALID_PAYLOAD, email: 'nofield2@example.com' },
      { ip: '10.0.2.2', simulateExistingUnverified: true }
    );
    expect(body(verified)).not.toHaveProperty('is_new_user');
    expect(body(unverified)).not.toHaveProperty('is_new_user');
  });

  it('message es idéntico entre registro nuevo y colisión verificada (literal match)', async () => {
    const newReg = await registerUser(
      { ...VALID_PAYLOAD, email: 'msgtest1@example.com' },
      { ip: '10.0.3.1' }
    );
    const collision = await registerUser(
      { ...VALID_PAYLOAD, email: 'msgtest2@example.com' },
      { ip: '10.0.3.2', simulateExistingVerified: true }
    );
    expect(body(collision)['message']).toBe(body(newReg)['message']);
  });

  it('message es idéntico entre registro nuevo y colisión no verificada', async () => {
    const newReg = await registerUser(
      { ...VALID_PAYLOAD, email: 'msgtest3@example.com' },
      { ip: '10.0.4.1' }
    );
    const collision = await registerUser(
      { ...VALID_PAYLOAD, email: 'msgtest4@example.com' },
      { ip: '10.0.4.2', simulateExistingUnverified: true }
    );
    expect(body(collision)['message']).toBe(body(newReg)['message']);
  });

  it('data.token_expires_at presente en registro nuevo (ISO-8601)', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'token1@example.com' },
      { ip: '10.0.5.1' }
    );
    expect(dataOf(result)['token_expires_at']).toMatch(ISO_8601_REGEX);
  });

  it('data.token_expires_at presente en colisión verificada (ISO-8601)', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'token2@example.com' },
      { ip: '10.0.5.2', simulateExistingVerified: true }
    );
    expect(dataOf(result)['token_expires_at']).toMatch(ISO_8601_REGEX);
  });

  it('data.token_expires_at presente en colisión en cooldown (ISO-8601)', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'token3@example.com' },
      { ip: '10.0.5.3', simulateEmailInCooldown: true }
    );
    expect(dataOf(result)['token_expires_at']).toMatch(ISO_8601_REGEX);
  });
});

// =============================================================================
// GRUPO 2 — UUID Dummy: Rotación y validez (8 tests)
// Los UUID dummy en colisiones son únicos por llamada y válidos (RFC 4122).
// Ref: PROJECT_spec.md §Política anti-enumeración — UUID dummy rotativo
// =============================================================================

describe('[B02-V] UUID Dummy — Rotación, unicidad y conformidad RFC 4122', () => {
  it('user_id en registro nuevo es un UUID v4 válido', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'uuid1@example.com' },
      { ip: '10.1.0.1' }
    );
    expect(String(dataOf(result)['user_id'])).toMatch(UUID_V4_REGEX);
  });

  it('user_id en colisión verificada es un UUID v4 válido', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'uuid2@example.com' },
      { ip: '10.1.0.2', simulateExistingVerified: true }
    );
    expect(String(dataOf(result)['user_id'])).toMatch(UUID_V4_REGEX);
  });

  it('user_id en colisión no verificada es un UUID v4 válido', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'uuid3@example.com' },
      { ip: '10.1.0.3', simulateExistingUnverified: true }
    );
    expect(String(dataOf(result)['user_id'])).toMatch(UUID_V4_REGEX);
  });

  it('user_id en cooldown es un UUID v4 válido', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'uuid4@example.com' },
      { ip: '10.1.0.4', simulateEmailInCooldown: true }
    );
    expect(String(dataOf(result)['user_id'])).toMatch(UUID_V4_REGEX);
  });

  it('user_id en colisión #1 es distinto al de colisión #2 (mismo email, mismo tipo)', async () => {
    const call1 = await registerUser(
      { ...VALID_PAYLOAD, email: 'rotation1@example.com' },
      { ip: '10.1.1.1', simulateExistingVerified: true }
    );
    const call2 = await registerUser(
      { ...VALID_PAYLOAD, email: 'rotation1@example.com' },
      { ip: '10.1.1.2', simulateExistingVerified: true }
    );
    expect(dataOf(call1)['user_id']).not.toBe(dataOf(call2)['user_id']);
  });

  it('user_id en colisión verificada es distinto al de colisión no verificada', async () => {
    const verified = await registerUser(
      { ...VALID_PAYLOAD, email: 'rotation2@example.com' },
      { ip: '10.1.2.1', simulateExistingVerified: true }
    );
    const unverified = await registerUser(
      { ...VALID_PAYLOAD, email: 'rotation2@example.com' },
      { ip: '10.1.2.2', simulateExistingUnverified: true }
    );
    expect(dataOf(verified)['user_id']).not.toBe(dataOf(unverified)['user_id']);
  });

  it('10 llamadas sucesivas en colisión producen 10 UUID distintos (prueba estadística)', async () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = await registerUser(
        { ...VALID_PAYLOAD, email: `statistic${i}@example.com` },
        { ip: `10.1.3.${i + 1}`, simulateExistingVerified: true }
      );
      uuids.add(String(dataOf(result)['user_id']));
    }
    // Todos los UUIDs deben ser únicos — ninguno debe repetirse
    expect(uuids.size).toBe(10);
  });

  it('user_id está en formato lowercase (normalización de UUID)', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'lowercase@example.com' },
      { ip: '10.1.4.1', simulateExistingVerified: true }
    );
    const userId = String(dataOf(result)['user_id']);
    expect(userId).toBe(userId.toLowerCase());
  });
});

// =============================================================================
// GRUPO 3 — Rate Limit: Headers y formato (8 tests)
// Verifica el contrato exacto de los headers de rate limit.
// Ref: PROJECT_spec.md §RNF7 — Rate Limiting Fixed Window
// =============================================================================

describe('[B02-V] Rate Limit — Headers, formato Unix Epoch y contrato HTTP', () => {
  it('X-RateLimit-Reset es un número Unix Epoch (no string ISO-8601)', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'rl1@example.com' },
      { ip: '10.2.0.1' }
    );
    const resetHeader = result.headers['X-RateLimit-Reset'];
    expect(resetHeader).toBeDefined();
    // No debe ser formato ISO-8601 (no contiene "T" ni "Z")
    expect(resetHeader).not.toMatch(/T.*Z/);
    // Debe ser un número entero como string
    expect(resetHeader).toMatch(/^\d+$/);
  });

  it('X-RateLimit-Reset > 0 — el epoch de reset es un timestamp futuro válido', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'rl2@example.com' },
      { ip: '10.2.0.2' }
    );
    const resetValue = Number(result.headers['X-RateLimit-Reset']);
    expect(resetValue).toBeGreaterThan(0);
  });

  it('X-RateLimit-Reset < 2^31 — razonable como Unix timestamp en segundos', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'rl3@example.com' },
      { ip: '10.2.0.3' }
    );
    const resetValue = Number(result.headers['X-RateLimit-Reset']);
    // 2^31 = 2147483648 — máximo int32, año 2038. Un timestamp razonable estará por debajo.
    expect(resetValue).toBeLessThan(Math.pow(2, 31));
  });

  it('X-RateLimit-Remaining decrementa de 4 a 3 entre dos llamadas consecutivas de la misma IP', async () => {
    const ip = '10.2.1.1';
    const call1 = await registerUser(
      { ...VALID_PAYLOAD, email: 'decrement1@example.com' },
      { ip }
    );
    const call2 = await registerUser(
      { ...VALID_PAYLOAD, email: 'decrement2@example.com' },
      { ip }
    );
    const remaining1 = Number(call1.headers['X-RateLimit-Remaining']);
    const remaining2 = Number(call2.headers['X-RateLimit-Remaining']);
    expect(remaining1).toBe(4);
    expect(remaining2).toBe(3);
  });

  it('X-RateLimit-Limit es siempre "5" (string) — límite fijo del contrato', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'limit1@example.com' },
      { ip: '10.2.2.1' }
    );
    expect(result.headers['X-RateLimit-Limit']).toBe('5');
  });

  it('Retry-After está presente en respuesta 429', async () => {
    const ip = '10.2.3.1';
    // Consumir las 5 peticiones permitidas
    for (let i = 0; i < 5; i++) {
      await registerUser(
        { ...VALID_PAYLOAD, email: `exhaust${i}@example.com` },
        { ip }
      );
    }
    // La 6ª petición debe retornar 429
    const blocked = await registerUser(
      { ...VALID_PAYLOAD, email: 'blocked@example.com' },
      { ip }
    );
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['Retry-After']).toBeDefined();
  });

  it('Retry-After en 429 es un número positivo de segundos', async () => {
    const ip = '10.2.4.1';
    for (let i = 0; i < 5; i++) {
      await registerUser(
        { ...VALID_PAYLOAD, email: `exhaust2_${i}@example.com` },
        { ip }
      );
    }
    const blocked = await registerUser(
      { ...VALID_PAYLOAD, email: 'blocked2@example.com' },
      { ip }
    );
    expect(blocked.statusCode).toBe(429);
    const retryAfter = Number(blocked.headers['Retry-After']);
    expect(retryAfter).toBeGreaterThan(0);
  });

  it('headers de rate limit están presentes incluso en respuesta 400 INVALID_AGE', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, birthdate: '2020-01-01' },
      { ip: '10.2.5.1' }
    );
    expect(result.statusCode).toBe(400);
    expect(result.headers['X-RateLimit-Limit']).toBeDefined();
    expect(result.headers['X-RateLimit-Remaining']).toBeDefined();
    expect(result.headers['X-RateLimit-Reset']).toBeDefined();
  });
});

// =============================================================================
// GRUPO 4 — Inmutabilidad de idioma: error_code en inglés, message en español (10 tests)
// El contrato de API es invariable — los códigos son en INGLÉS, los mensajes en ESPAÑOL.
// Ref: CLAUDE.md §Convenciones de Idioma + PROJECT_spec.md §Contrato de Errores
// =============================================================================

describe('[B02-V] Inmutabilidad de idioma — error_code en inglés, message en español', () => {
  it('error_code INVALID_AGE está en inglés snake_case', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, birthdate: '2020-01-01' },
      { ip: '10.3.0.1' }
    );
    expect(body(result)['error_code']).toBe('INVALID_AGE');
  });

  it('message de INVALID_AGE contiene texto en español con referencia a "mayor de 18"', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, birthdate: '2020-01-01' },
      { ip: '10.3.0.2' }
    );
    const message = String(body(result)['message']);
    expect(message).toMatch(/mayor de 18/i);
  });

  it('error_code WEAK_PASSWORD está en inglés snake_case', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, password: 'weakpassword' },
      { ip: '10.3.1.1' }
    );
    expect(body(result)['error_code']).toBe('WEAK_PASSWORD');
  });

  it('message de WEAK_PASSWORD contiene texto en español', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, password: 'weakpassword' },
      { ip: '10.3.1.2' }
    );
    const message = String(body(result)['message']);
    // El mensaje describe los requisitos de la contraseña en español
    expect(message.length).toBeGreaterThan(10);
    // No debe estar en inglés — no contiene palabras clave en inglés comunes
    expect(message).not.toMatch(/^[A-Za-z\s]+$/);
  });

  it('error_code INVALID_EMAIL_FORMAT está en inglés snake_case', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'not-an-email' },
      { ip: '10.3.2.1' }
    );
    expect(body(result)['error_code']).toBe('INVALID_EMAIL_FORMAT');
  });

  it('error_code TERMS_NOT_ACCEPTED está en inglés snake_case', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, terms_accepted: false },
      { ip: '10.3.3.1' }
    );
    expect(body(result)['error_code']).toBe('TERMS_NOT_ACCEPTED');
  });

  it('error_code REGISTRATION_LIMIT_EXCEEDED está en inglés snake_case', async () => {
    const ip = '10.3.4.1';
    for (let i = 0; i < 5; i++) {
      await registerUser(
        { ...VALID_PAYLOAD, email: `limit_en${i}@example.com` },
        { ip }
      );
    }
    const blocked = await registerUser(
      { ...VALID_PAYLOAD, email: 'limitenblocked@example.com' },
      { ip }
    );
    expect(body(blocked)['error_code']).toBe('REGISTRATION_LIMIT_EXCEEDED');
  });

  it('error_code SYSTEM_DEGRADED está en inglés snake_case', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD },
      { ip: '10.3.5.1', simulateRedisFailure: true }
    );
    expect(body(result)['error_code']).toBe('SYSTEM_DEGRADED');
  });

  it('error_code MALFORMED_REQUEST está en inglés snake_case', async () => {
    // birthdate con formato inválido → MALFORMED_REQUEST
    const result = await registerUser(
      { ...VALID_PAYLOAD, birthdate: 'not-a-date' },
      { ip: '10.3.6.1' }
    );
    expect(body(result)['error_code']).toBe('MALFORMED_REQUEST');
  });

  it('message NO es igual a error_code — son campos semánticamente distintos', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, birthdate: '2020-01-01' },
      { ip: '10.3.7.1' }
    );
    const errorCode = body(result)['error_code'];
    const message = body(result)['message'];
    expect(message).not.toBe(errorCode);
  });
});

// =============================================================================
// GRUPO 5 — warning_code EMAIL_DISPATCH_FAILED (6 tests)
// Registro exitoso (201) con fallo de envío de correo → degradación graciosa.
// Ref: PROJECT_spec.md §RF — Email dispatch resilience + CLAUDE.md §Resiliency
// =============================================================================

describe('[B02-V] warning_code EMAIL_DISPATCH_FAILED — Degradación graciosa en envío de email', () => {
  it('statusCode es 201 cuando falla el envío de email (no 500 ni 202)', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'emailfail1@example.com' },
      { ip: '10.4.0.1', simulateEmailFailure: true }
    );
    expect(result.statusCode).toBe(201);
  });

  it('body contiene warning_code: "EMAIL_DISPATCH_FAILED"', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'emailfail2@example.com' },
      { ip: '10.4.0.2', simulateEmailFailure: true }
    );
    expect(body(result)['warning_code']).toBe('EMAIL_DISPATCH_FAILED');
  });

  it('body contiene status: "success" aun con warning_code', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'emailfail3@example.com' },
      { ip: '10.4.0.3', simulateEmailFailure: true }
    );
    expect(body(result)['status']).toBe('success');
  });

  it('body contiene data.user_id como UUID v4 válido en fallo de email', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'emailfail4@example.com' },
      { ip: '10.4.0.4', simulateEmailFailure: true }
    );
    expect(String(dataOf(result)['user_id'])).toMatch(UUID_V4_REGEX);
  });

  it('body contiene data.token_expires_at en ISO-8601 en fallo de email', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'emailfail5@example.com' },
      { ip: '10.4.0.5', simulateEmailFailure: true }
    );
    expect(String(dataOf(result)['token_expires_at'])).toMatch(ISO_8601_REGEX);
  });

  it('message en fallo de email es distinto al mensaje estándar de éxito (indica procesamiento)', async () => {
    const successResult = await registerUser(
      { ...VALID_PAYLOAD, email: 'emailsuccess@example.com' },
      { ip: '10.4.1.1' }
    );
    const failResult = await registerUser(
      { ...VALID_PAYLOAD, email: 'emailfail6@example.com' },
      { ip: '10.4.1.2', simulateEmailFailure: true }
    );
    expect(body(failResult)['message']).not.toBe(body(successResult)['message']);
  });
});

// =============================================================================
// GRUPO 6 — SOP en todos los status codes (8 tests)
// version: "1.0.0" y timestamp ISO-8601 presentes en TODA respuesta.
// Ref: PROJECT_spec.md §SOP Global Inheritance — campos mandatorios universales
// =============================================================================

describe('[B02-V] SOP Compliance — version y timestamp en todos los status codes', () => {
  it('respuesta 201 de registro nuevo contiene version: "1.0.0" y timestamp ISO-8601', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'sop201new@example.com' },
      { ip: '10.5.0.1' }
    );
    expect(result.statusCode).toBe(201);
    expect(body(result)['version']).toBe('1.0.0');
    expect(String(body(result)['timestamp'])).toMatch(ISO_8601_REGEX);
  });

  it('respuesta 201 de colisión verificada contiene version y timestamp', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'sop201col@example.com' },
      { ip: '10.5.0.2', simulateExistingVerified: true }
    );
    expect(result.statusCode).toBe(201);
    expect(body(result)['version']).toBe('1.0.0');
    expect(String(body(result)['timestamp'])).toMatch(ISO_8601_REGEX);
  });

  it('respuesta 400 INVALID_AGE contiene version y timestamp', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, birthdate: '2020-01-01' },
      { ip: '10.5.1.1' }
    );
    expect(result.statusCode).toBe(400);
    expect(body(result)['version']).toBe('1.0.0');
    expect(String(body(result)['timestamp'])).toMatch(ISO_8601_REGEX);
  });

  it('respuesta 400 WEAK_PASSWORD contiene version y timestamp', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, password: 'weak' },
      { ip: '10.5.1.2' }
    );
    expect(result.statusCode).toBe(400);
    expect(body(result)['version']).toBe('1.0.0');
    expect(String(body(result)['timestamp'])).toMatch(ISO_8601_REGEX);
  });

  it('respuesta 400 INVALID_EMAIL_FORMAT contiene version y timestamp', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'bademail' },
      { ip: '10.5.1.3' }
    );
    expect(result.statusCode).toBe(400);
    expect(body(result)['version']).toBe('1.0.0');
    expect(String(body(result)['timestamp'])).toMatch(ISO_8601_REGEX);
  });

  it('respuesta 429 contiene version y timestamp', async () => {
    const ip = '10.5.2.1';
    for (let i = 0; i < 5; i++) {
      await registerUser(
        { ...VALID_PAYLOAD, email: `sop429_${i}@example.com` },
        { ip }
      );
    }
    const blocked = await registerUser(
      { ...VALID_PAYLOAD, email: 'sop429blocked@example.com' },
      { ip }
    );
    expect(blocked.statusCode).toBe(429);
    expect(body(blocked)['version']).toBe('1.0.0');
    expect(String(body(blocked)['timestamp'])).toMatch(ISO_8601_REGEX);
  });

  it('respuesta 503 SYSTEM_DEGRADED contiene version y timestamp', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD },
      { ip: '10.5.3.1', simulateRedisFailure: true }
    );
    expect(result.statusCode).toBe(503);
    expect(body(result)['version']).toBe('1.0.0');
    expect(String(body(result)['timestamp'])).toMatch(ISO_8601_REGEX);
  });

  it('timestamp es ISO-8601 con milisegundos (.000Z) en TODA respuesta — registro exitoso', async () => {
    const result = await registerUser(
      { ...VALID_PAYLOAD, email: 'sopms@example.com' },
      { ip: '10.5.4.1' }
    );
    const timestamp = String(body(result)['timestamp']);
    // Verificar que tiene milisegundos: debe terminar con .[3 dígitos]Z
    expect(timestamp).toMatch(/\.\d{3}Z$/);
  });
});
