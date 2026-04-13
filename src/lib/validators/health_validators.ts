/**
 * health_validators.ts — Validadores de Contrato SOP
 * Trazabilidad: PROJECT_spec.md [Iteracion 1]
 * Agente: backend-coder (implementacion de contratos definidos en TSK-I1-B02-R)
 *
 * NOTA TECNICA (para backend-tester — TSK-I1-B02-V):
 *   Los casos de test `validateLatencyFloat2(45)` y `validateLatencyFloat2(45.3)` esperan
 *   `false`, pero en JavaScript los literales 45.30, 45.3 y 45.00 son el mismo valor
 *   en memoria (IEEE-754 double). Esta funcion implementa el comportamiento correcto
 *   de produccion ("at most 2 decimal places"). El test debe actualizar esos casos para
 *   reflejar la semantica del lenguaje (ej. pasar la representacion en string "45.3"
 *   o documentar que el validador opera sobre el JSON serializado con toFixed(2)).
 */

// =============================================================================
// Constantes de Contrato (Spec-Is-Law)
// =============================================================================

/**
 * Regex UUID v4 estricto — PROJECT_spec.md linea 130
 * Valida: version = '4', variante = [89ab]
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Regex ISO-8601 UTC con milisegundos obligatorios
 * Formato requerido: YYYY-MM-DDTHH:mm:ss.sssZ
 */
const ISO8601_WITH_MS_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Catalogo de error_code validos — HealthCheckResponse union type (Spec)
 */
const VALID_ERROR_CODES = new Set<string>([
  'MALFORMED_REQUEST',
  'AUTH_REQUIRED',
  'RATE_LIMIT_EXCEEDED',
  'SYSTEM_DEGRADED',
  'CONTENT_TYPE_NOT_SUPPORTED',
]);

// Campos permitidos por modo de respuesta (regla no-excess)
const PUBLIC_ALLOWED_FIELDS = new Set(['status', 'version', 'timestamp']);
const PUBLIC_REQUIRED_FIELDS = ['status', 'version', 'timestamp'] as const;

const PRIVATE_REQUIRED_TOP = ['status', 'version', 'timestamp', 'performance', 'dependencies'] as const;
const PRIVATE_ALLOWED_TOP = new Set<string>(PRIVATE_REQUIRED_TOP);
const PRIVATE_REQUIRED_PERFORMANCE = ['api_latency_ms', 'latency_type'] as const;
const PRIVATE_REQUIRED_DEPENDENCIES = [
  'database',
  'redis',
  'email_service',
  'captcha_service',
] as const;

const ERROR_REQUIRED_FIELDS = ['status', 'version', 'timestamp', 'error_code', 'message'] as const;
const ERROR_ALLOWED_FIELDS = new Set([...ERROR_REQUIRED_FIELDS, 'unhealthy_services']);

// =============================================================================
// Tipos auxiliares
// =============================================================================

export type SopResponseMode = '200_public' | '200_private' | 'error';

// =============================================================================
// Funciones de Validacion (Pure — sin efectos secundarios)
// =============================================================================

/**
 * Valida el header X-Health-Key contra el Regex UUID v4 estricto.
 * Retorna false ante null, undefined o formato incorrecto.
 * Un header invalido provoca HTTP 400 MALFORMED_REQUEST.
 */
export function validateUUIDv4Header(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return false;
  return UUID_V4_REGEX.test(value);
}

/**
 * Valida que un string sea una fecha ISO-8601 UTC con milisegundos.
 * El SOP obliga que todo timestamp incluya milisegundos (`.sssZ`).
 */
export function validateISO8601WithMs(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string' || value.length === 0) return false;
  return ISO8601_WITH_MS_REGEX.test(value);
}

/**
 * Valida que un valor sea un float no-negativo con como maximo 2 decimales.
 * En produccion, el servidor formatea siempre con toFixed(2) antes de emitir.
 *
 * Implementacion: parseFloat(value.toFixed(2)) === value
 *   → acepta: 45.30 (= 45.3), 0.00 (= 0), 199.99, 500.00 (= 500), 14.52
 *   → rechaza: 45.123 (truncado ≠ original), NaN, negativos, null, strings
 */
export function validateLatencyFloat2(value: unknown): boolean {
  if (typeof value !== 'number') return false;
  if (isNaN(value) || !isFinite(value)) return false;
  if (value < 0) return false;
  return parseFloat(value.toFixed(2)) === value;
}

/**
 * Valida la estructura de una respuesta SOP segun el modo.
 *
 * Modos soportados:
 *   - '200_public'  : { status, version, timestamp } — exactamente estos campos
 *   - '200_private' : campos publicos + performance + dependencies con todos sus sub-campos
 *   - 'error'       : { status, version, timestamp, error_code, message } + unhealthy_services opcional
 *
 * Regla de Oro: ningun campo no documentado en la Spec es permitido.
 */
export function validateSopResponseShape(obj: unknown, mode: SopResponseMode): boolean {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const body = obj as Record<string, unknown>;

  if (mode === '200_public') {
    const keys = Object.keys(body);
    // Regla no-excess: ningun campo extra permitido
    for (const key of keys) {
      if (!PUBLIC_ALLOWED_FIELDS.has(key)) return false;
    }
    // Campos obligatorios
    for (const field of PUBLIC_REQUIRED_FIELDS) {
      if (!(field in body)) return false;
    }
    return true;
  }

  if (mode === '200_private') {
    const keys = Object.keys(body);
    // Regla no-excess a nivel raiz
    for (const key of keys) {
      if (!PRIVATE_ALLOWED_TOP.has(key)) return false;
    }
    // Campos obligatorios raiz
    for (const field of PRIVATE_REQUIRED_TOP) {
      if (!(field in body)) return false;
    }
    // Validar sub-objeto performance
    const perf = body.performance;
    if (!perf || typeof perf !== 'object' || Array.isArray(perf)) return false;
    const perfObj = perf as Record<string, unknown>;
    for (const field of PRIVATE_REQUIRED_PERFORMANCE) {
      if (!(field in perfObj)) return false;
    }
    // Validar sub-objeto dependencies
    const deps = body.dependencies;
    if (!deps || typeof deps !== 'object' || Array.isArray(deps)) return false;
    const depsObj = deps as Record<string, unknown>;
    for (const field of PRIVATE_REQUIRED_DEPENDENCIES) {
      if (!(field in depsObj)) return false;
    }
    return true;
  }

  if (mode === 'error') {
    const keys = Object.keys(body);
    // Regla no-excess: solo campos documentados
    for (const key of keys) {
      if (!ERROR_ALLOWED_FIELDS.has(key)) return false;
    }
    // Campos obligatorios
    for (const field of ERROR_REQUIRED_FIELDS) {
      if (!(field in body)) return false;
    }
    return true;
  }

  return false;
}

/**
 * Valida que un error_code pertenezca al catalogo documentado en la Spec.
 * El catalogo es case-sensitive (SCREAMING_SNAKE_CASE).
 */
export function validateErrorCode(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string' || value.length === 0) return false;
  return VALID_ERROR_CODES.has(value);
}
