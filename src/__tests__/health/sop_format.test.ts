/**
 * TSK-I1-B02-R — SOP Format Unit Tests
 * Agente: backend-tester
 * Trazabilidad: PROJECT_spec.md [Iteracion 1, linea 130] + api-contract-tester SKILL
 *
 * Proposito RED: Estos tests validan los contratos de formato del SOP del endpoint
 * /api/v1/health. DEBEN FALLAR porque los modulos de implementacion no existen aun.
 * La confirmacion de fallo (RED) es el DoD de esta tarea.
 *
 * Contratos validados:
 *   1. UUID v4 — Regex estricto (spec linea 130): /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
 *   2. ISO-8601 UTC con Milisegundos — Formato: YYYY-MM-DDTHH:mm:ss.sssZ
 *   3. Latencia Float-2 — api_latency_ms: numero con exactamente 2 decimales
 *   4. Estructura SOP — Campos obligatorios presentes en toda respuesta (2xx, 4xx, 5xx)
 *   5. Codigos de error — error_code mapeado a los valores del catalogo de la Spec
 */

// ATENCION: Estos imports FALLARAN hasta que TSK-I1-B02-G implemente los modulos.
// Este fallo deliberado es el estado RED requerido por el protocolo TDD.
import {
  validateUUIDv4Header,
  validateISO8601WithMs,
  validateLatencyFloat2,
  validateSopResponseShape,
  validateErrorCode,
} from '@/src/lib/validators/health_validators';

// =============================================================================
// BLOQUE 1: Validacion de X-Health-Key (UUID v4 Estricto)
// Ref: PROJECT_spec.md linea 130
// =============================================================================

describe('[B02-R] X-Health-Key — UUID v4 Regex Estricto', () => {
  // Casos validos: deben retornar true
  describe('Casos validos (esperan true)', () => {
    it('acepta un UUID v4 bien formado en minusculas', () => {
      expect(validateUUIDv4Header('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('acepta un UUID v4 con variante 8 (89ab: 8)', () => {
      expect(validateUUIDv4Header('6ba7b810-9dad-41d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('acepta un UUID v4 con variante 9 (89ab: 9)', () => {
      expect(validateUUIDv4Header('6ba7b810-9dad-41d1-90b4-00c04fd430c8')).toBe(true);
    });

    it('acepta un UUID v4 con variante a (89ab: a)', () => {
      expect(validateUUIDv4Header('6ba7b810-9dad-41d1-a0b4-00c04fd430c8')).toBe(true);
    });

    it('acepta un UUID v4 con variante b (89ab: b)', () => {
      expect(validateUUIDv4Header('6ba7b810-9dad-41d1-b0b4-00c04fd430c8')).toBe(true);
    });

    it('es case-insensitive: acepta UUID en mayusculas', () => {
      expect(validateUUIDv4Header('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });
  });

  // Casos invalidos: deben retornar false y el endpoint debe responder 400
  describe('Casos invalidos (esperan false → HTTP 400)', () => {
    it('rechaza un string vacio', () => {
      expect(validateUUIDv4Header('')).toBe(false);
    });

    it('rechaza un UUID v1 (version incorrecta, no es 4)', () => {
      // Caracter de version es '1', no '4'
      expect(validateUUIDv4Header('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(false);
    });

    it('rechaza un UUID v3 (version 3)', () => {
      expect(validateUUIDv4Header('6ba7b810-9dad-31d1-80b4-00c04fd430c8')).toBe(false);
    });

    it('rechaza un UUID con variante invalida (no 8/9/a/b)', () => {
      // Caracter de variante es 'c', no esta en [89ab]
      expect(validateUUIDv4Header('6ba7b810-9dad-41d1-c0b4-00c04fd430c8')).toBe(false);
    });

    it('rechaza un UUID con guiones en posicion incorrecta', () => {
      expect(validateUUIDv4Header('550e8400e29b-41d4-a716-446655440000')).toBe(false);
    });

    it('rechaza un UUID con longitud incorrecta (demasiado corto)', () => {
      expect(validateUUIDv4Header('550e8400-e29b-41d4-a716-44665544000')).toBe(false);
    });

    it('rechaza un UUID con longitud incorrecta (demasiado largo)', () => {
      expect(validateUUIDv4Header('550e8400-e29b-41d4-a716-4466554400000')).toBe(false);
    });

    it('rechaza un UUID con caracteres no hexadecimales', () => {
      expect(validateUUIDv4Header('550e8400-e29b-41d4-a716-44665544000z')).toBe(false);
    });

    it('rechaza null (header ausente tratado como null)', () => {
      expect(validateUUIDv4Header(null)).toBe(false);
    });

    it('rechaza undefined (header no enviado)', () => {
      expect(validateUUIDv4Header(undefined)).toBe(false);
    });

    it('rechaza un texto arbitrario que no es UUID', () => {
      expect(validateUUIDv4Header('not-a-uuid-at-all')).toBe(false);
    });
  });
});

// =============================================================================
// BLOQUE 2: Validacion de Timestamp (ISO-8601 UTC con Milisegundos)
// Ref: PROJECT_spec.md — campo "timestamp" en todos los payloads
// =============================================================================

describe('[B02-R] timestamp — ISO-8601 UTC con Milisegundos', () => {
  describe('Casos validos (esperan true)', () => {
    it('acepta fecha ISO-8601 con milisegundos y sufijo Z', () => {
      expect(validateISO8601WithMs('2026-04-11T20:00:00.000Z')).toBe(true);
    });

    it('acepta fecha ISO-8601 con milisegundos no cero', () => {
      expect(validateISO8601WithMs('2026-04-11T20:00:00.123Z')).toBe(true);
    });

    it('acepta fecha ISO-8601 en medianoche UTC', () => {
      expect(validateISO8601WithMs('2026-01-01T00:00:00.001Z')).toBe(true);
    });
  });

  describe('Casos invalidos (esperan false)', () => {
    it('rechaza fecha sin milisegundos', () => {
      // El SOP exige milisegundos explicitos — "2026-04-11T20:00:00Z" no es valido
      expect(validateISO8601WithMs('2026-04-11T20:00:00Z')).toBe(false);
    });

    it('rechaza fecha sin sufijo de zona horaria', () => {
      expect(validateISO8601WithMs('2026-04-11T20:00:00.000')).toBe(false);
    });

    it('rechaza un timestamp Unix (numero)', () => {
      expect(validateISO8601WithMs('1744387200000')).toBe(false);
    });

    it('rechaza un string de fecha sin hora', () => {
      expect(validateISO8601WithMs('2026-04-11')).toBe(false);
    });

    it('rechaza un string vacio', () => {
      expect(validateISO8601WithMs('')).toBe(false);
    });

    it('rechaza null', () => {
      expect(validateISO8601WithMs(null)).toBe(false);
    });
  });
});

// =============================================================================
// BLOQUE 3: Validacion de Latencia (Float con exactamente 2 decimales)
// Ref: PROJECT_spec.md — campo "api_latency_ms" en performance
// =============================================================================

describe('[B02-R] api_latency_ms — Float con 2 Decimales (Float-2)', () => {
  describe('Casos validos (esperan true)', () => {
    it('acepta 45.30 (float con 2 decimales)', () => {
      expect(validateLatencyFloat2(45.30)).toBe(true);
    });

    it('acepta 0.00 (latencia minima valida)', () => {
      expect(validateLatencyFloat2(0.00)).toBe(true);
    });

    it('acepta 199.99 (SLA Green boundary)', () => {
      expect(validateLatencyFloat2(199.99)).toBe(true);
    });

    it('acepta 500.00 (SLA Critical boundary)', () => {
      expect(validateLatencyFloat2(500.00)).toBe(true);
    });

    it('acepta 14.52 (ejemplo de la spec)', () => {
      expect(validateLatencyFloat2(14.52)).toBe(true);
    });
  });

  describe('Casos invalidos (esperan false)', () => {
    // NOTA JS: En JavaScript, los literales 45, 45.0 y 45.00 son el mismo valor IEEE-754.
    // Igualmente, 45.3 y 45.30 son identicos en memoria. Por ello el validador no puede
    // distinguirlos a nivel numerico. La restriccion "siempre float-2" se aplica en la
    // SERIALIZACION del response (toFixed(2)) — no en la validacion del numero en si.
    // Los tests que verificaban `45` → false y `45.3` → false han sido corregidos para
    // reflejar la semantica real de JavaScript (TSK-I1-B02-G).

    it('rechaza un float con 3 decimales — excede la precision maxima (45.123)', () => {
      // 45.123.toFixed(2) = "45.12" → 45.12 !== 45.123 → false
      expect(validateLatencyFloat2(45.123)).toBe(false);
    });

    it('rechaza un float con 3 decimales — caso adicional (1.001)', () => {
      // 1.001.toFixed(2) = "1.00" → 1.00 !== 1.001 → false
      expect(validateLatencyFloat2(1.001)).toBe(false);
    });

    it('rechaza un valor negativo (-1.00)', () => {
      // La latencia no puede ser negativa
      expect(validateLatencyFloat2(-1.00)).toBe(false);
    });

    it('rechaza null', () => {
      expect(validateLatencyFloat2(null)).toBe(false);
    });

    it('rechaza un string numerico ("45.30")', () => {
      expect(validateLatencyFloat2('45.30')).toBe(false);
    });

    it('rechaza NaN', () => {
      expect(validateLatencyFloat2(NaN)).toBe(false);
    });
  });
});

// =============================================================================
// BLOQUE 4: Estructura SOP — Campos obligatorios en toda respuesta
// Ref: PROJECT_spec.md — "Protocolo de Error (SOP)" — seccion linea 118
// =============================================================================

describe('[B02-R] SOP Response Shape — Campos Obligatorios', () => {
  describe('Respuesta 200 OK (Modo Publico)', () => {
    it('contiene exactamente los campos status, version y timestamp', () => {
      const publicResponse = {
        status: 'healthy',
        version: '1.0.0',
        timestamp: '2026-04-11T20:00:00.000Z',
      };
      expect(validateSopResponseShape(publicResponse, '200_public')).toBe(true);
    });

    it('falla si falta el campo version', () => {
      const malformed = { status: 'healthy', timestamp: '2026-04-11T20:00:00.000Z' };
      expect(validateSopResponseShape(malformed, '200_public')).toBe(false);
    });

    it('falla si falta el campo timestamp', () => {
      const malformed = { status: 'healthy', version: '1.0.0' };
      expect(validateSopResponseShape(malformed, '200_public')).toBe(false);
    });

    it('falla si contiene campos fantasma no documentados (no-excess rule)', () => {
      const withExtra = {
        status: 'healthy',
        version: '1.0.0',
        timestamp: '2026-04-11T20:00:00.000Z',
        undocumented_field: 'ghost',
      };
      expect(validateSopResponseShape(withExtra, '200_public')).toBe(false);
    });
  });

  describe('Respuesta 200 OK (Modo Privado — con X-Health-Key valida)', () => {
    it('contiene status, version, timestamp, performance y dependencies', () => {
      const privateResponse = {
        status: 'healthy',
        version: '1.0.0',
        timestamp: '2026-04-11T20:00:00.000Z',
        performance: {
          api_latency_ms: 45.30,
          latency_type: 'Server-side processing (including DB/Redis check)',
        },
        dependencies: {
          database: 'connected',
          redis: 'connected',
          email_service: 'config_valid',
          captcha_service: 'config_valid',
        },
      };
      expect(validateSopResponseShape(privateResponse, '200_private')).toBe(true);
    });

    it('falla si performance no contiene api_latency_ms', () => {
      const missingLatency = {
        status: 'healthy',
        version: '1.0.0',
        timestamp: '2026-04-11T20:00:00.000Z',
        performance: { latency_type: 'Server-side processing' },
        dependencies: {
          database: 'connected',
          redis: 'connected',
          email_service: 'config_valid',
          captcha_service: 'config_valid',
        },
      };
      expect(validateSopResponseShape(missingLatency, '200_private')).toBe(false);
    });

    it('falla si dependencies omite algun servicio critico', () => {
      const missingDep = {
        status: 'healthy',
        version: '1.0.0',
        timestamp: '2026-04-11T20:00:00.000Z',
        performance: { api_latency_ms: 45.30, latency_type: 'Server-side processing' },
        dependencies: {
          database: 'connected',
          // redis ausente
          email_service: 'config_valid',
          captcha_service: 'config_valid',
        },
      };
      expect(validateSopResponseShape(missingDep, '200_private')).toBe(false);
    });
  });

  describe('Respuesta de Error (4xx / 5xx)', () => {
    it('un error 400 contiene status, version, timestamp, error_code y message', () => {
      const error400 = {
        status: 'unhealthy',
        version: '1.0.0',
        timestamp: '2026-04-11T20:00:00.000Z',
        error_code: 'MALFORMED_REQUEST',
        message: 'Formato de X-Health-Key invalido (Debe ser UUID v4).',
      };
      expect(validateSopResponseShape(error400, 'error')).toBe(true);
    });

    it('un error 503 SYSTEM_DEGRADED incluye unhealthy_services', () => {
      const error503 = {
        status: 'unhealthy',
        version: '1.0.0',
        timestamp: '2026-04-11T20:00:00.000Z',
        error_code: 'SYSTEM_DEGRADED',
        message: 'Servicios criticos no disponibles.',
        unhealthy_services: ['database'],
      };
      expect(validateSopResponseShape(error503, 'error')).toBe(true);
    });

    it('falla si un error no incluye error_code', () => {
      const malformedError = {
        status: 'unhealthy',
        version: '1.0.0',
        timestamp: '2026-04-11T20:00:00.000Z',
        message: 'Error sin codigo.',
      };
      expect(validateSopResponseShape(malformedError, 'error')).toBe(false);
    });
  });
});

// =============================================================================
// BLOQUE 5: Catalogo de error_code — Solo valores documentados en la Spec
// Ref: PROJECT_spec.md — HealthCheckResponse union type
// =============================================================================

describe('[B02-R] error_code — Catalogo de Valores Validos', () => {
  const validCodes = [
    'MALFORMED_REQUEST',
    'AUTH_REQUIRED',
    'RATE_LIMIT_EXCEEDED',
    'SYSTEM_DEGRADED',
    'CONTENT_TYPE_NOT_SUPPORTED',
  ];

  validCodes.forEach((code) => {
    it(`acepta el codigo valido: ${code}`, () => {
      expect(validateErrorCode(code)).toBe(true);
    });
  });

  it('rechaza un codigo no documentado en la Spec', () => {
    expect(validateErrorCode('UNKNOWN_ERROR')).toBe(false);
  });

  it('rechaza un codigo en minusculas (case-sensitive)', () => {
    expect(validateErrorCode('malformed_request')).toBe(false);
  });

  it('rechaza null', () => {
    expect(validateErrorCode(null)).toBe(false);
  });

  it('rechaza un string vacio', () => {
    expect(validateErrorCode('')).toBe(false);
  });
});

// =============================================================================
// BLOQUE 6: Cobertura de ramas — casos de frontera no cubiertos por los bloques anteriores
// Referencia: informe de cobertura TSK-I1-B02-V
// =============================================================================

describe('[B02-V] Ramas de cobertura adicionales — validateUUIDv4Header', () => {
  it('rechaza un valor numerico (no-string, no-null)', () => {
    // Cubre la rama: typeof value !== "string" (linea 77)
    expect(validateUUIDv4Header(42 as unknown as string)).toBe(false);
  });

  it('rechaza un objeto (no-string, no-null)', () => {
    expect(validateUUIDv4Header({} as unknown as string)).toBe(false);
  });
});

describe('[B02-V] Ramas de cobertura adicionales — validateSopResponseShape', () => {
  it('retorna false cuando obj es un array (no es un objeto plano)', () => {
    // Cubre la rama: Array.isArray(obj) === true (linea 117)
    expect(validateSopResponseShape([], '200_public')).toBe(false);
    expect(validateSopResponseShape([], '200_private')).toBe(false);
    expect(validateSopResponseShape([], 'error')).toBe(false);
  });

  it('retorna false con campo extra en modo privado (no-excess rule)', () => {
    // Cubre la rama: !PRIVATE_ALLOWED_TOP.has(key) (linea 137)
    const withExtra = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:00:00.000Z',
      performance: { api_latency_ms: 45.30, latency_type: 'Server-side processing' },
      dependencies: {
        database: 'connected',
        redis: 'connected',
        email_service: 'config_valid',
        captcha_service: 'config_valid',
      },
      ghost_field: 'extra',
    };
    expect(validateSopResponseShape(withExtra, '200_private')).toBe(false);
  });

  it('retorna false si performance es un array en modo privado', () => {
    // Cubre la rama: Array.isArray(perf) (linea 145)
    const arrPerf = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:00:00.000Z',
      performance: [{ api_latency_ms: 45.30 }],
      dependencies: {
        database: 'connected',
        redis: 'connected',
        email_service: 'config_valid',
        captcha_service: 'config_valid',
      },
    };
    expect(validateSopResponseShape(arrPerf, '200_private')).toBe(false);
  });

  it('retorna false si dependencies es un array en modo privado', () => {
    // Cubre la rama: Array.isArray(deps) (linea 152)
    const arrDeps = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:00:00.000Z',
      performance: { api_latency_ms: 45.30, latency_type: 'Server-side processing' },
      dependencies: ['database', 'redis'],
    };
    expect(validateSopResponseShape(arrDeps, '200_private')).toBe(false);
  });

  it('retorna false con campo extra en modo error (no-excess rule)', () => {
    // Cubre la rama: !ERROR_ALLOWED_FIELDS.has(key) (linea 164)
    const withExtra = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:00:00.000Z',
      error_code: 'MALFORMED_REQUEST',
      message: 'test',
      ghost_field: 'extra',
    };
    expect(validateSopResponseShape(withExtra, 'error')).toBe(false);
  });
});
