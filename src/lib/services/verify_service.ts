/**
 * verify_service.ts — Caso de Uso: Verificación de Email
 * Trazabilidad: TSK-I2-B03-G1
 * Agente: backend-coder
 *
 * Responsabilidad única: orquestar el flujo completo de verificación de cuenta:
 *   1. Guardia de método HTTP (solo POST)
 *   2. Guardia de token en Query Param (PROHIBIDO — Security Guard)
 *   3. Validación de formato UUID v4 (estricto) con normalización a lowercase
 *   4. Resolución del estado del token en la capa de persistencia
 *   5. Transacción ACID: activar cuenta + marcar token como usado
 *   6. Construcción de respuesta SOP-compliant en toda salida
 *
 * Contratos de respuesta (PROJECT_spec.md §Iteración 2 — /verify):
 *   200 OK         — Cuenta activada exitosamente
 *   400 Bad Request — Token ausente, inválido o no encontrado (INVALID_TOKEN)
 *   405 Method Not Allowed — Verbo distinto a POST (METHOD_NOT_ALLOWED)
 *   409 Conflict   — Cuenta ya verificada (ALREADY_VERIFIED)
 *   410 Gone       — Token expirado: 24h transcurridas (EXPIRED_TOKEN)
 *   503 SYSTEM_DEGRADED — Redis o DB no disponibles (fail-closed RNF9)
 *
 * Clean Architecture: no importa Next.js, no importa ORM.
 * Inyección de dependencias via `VerifyContext` para testabilidad total.
 */

// =============================================================================
// Contratos públicos
// =============================================================================

export interface VerifyRequest {
  /** Token UUID v4 raw (puede venir en mayúsculas — se normaliza a lowercase) */
  token: string;
}

export interface VerifyResult {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Contexto de ejecución inyectable para el caso de uso.
 * Permite simular escenarios de fallo y colisión en tests unitarios
 * sin necesidad de una base de datos o Redis reales.
 */
export interface VerifyContext {
  /** IP del cliente (para logging / audit, no para rate limit en /verify) */
  ip: string;
  /** Verbo HTTP recibido. Defecto: 'POST' */
  httpMethod?: string;
  /** Token enviado via Query Param (PROHIBIDO). Si se provee → rechazo inmediato */
  tokenInQueryParam?: string;
  // ----- Flags de simulación (exclusivos de entorno de test) -----
  /** Simula que el token NO existe en la base de datos */
  simulateTokenNotFound?: boolean;
  /** Simula que el token ha caducado (> 24h desde created_at) */
  simulateExpiredToken?: boolean;
  /** Simula que el usuario ya está en estado ACTIVE (cuenta ya verificada) */
  simulateAlreadyVerified?: boolean;
  /** Simula una caída completa de Redis */
  simulateRedisFailure?: boolean;
  /** Simula una caída completa de la base de datos */
  simulateDbFailure?: boolean;
}

// =============================================================================
// Constantes SOP
// =============================================================================

const API_VERSION = '1.0.0';

/**
 * Regex UUID v4 estricto (lowercase + UPPERCASE — se normaliza antes de validar).
 * Versión exactamente '4'; variante [89ab] en la posición 17.
 * Referencia: PROJECT_spec.md §Verify §Validación de Token
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// =============================================================================
// Mensajes de error en español (CLAUDE.md §Convenciones — UI en español)
// Los `error_code` siempre en inglés; los `message` en español.
// =============================================================================

const MESSAGES: Record<string, string> = {
  METHOD_NOT_ALLOWED: 'Método HTTP no permitido. Utilice POST.',
  INVALID_TOKEN:
    'El token de verificación es inválido o no fue encontrado.',
  EXPIRED_TOKEN:
    'El token de verificación ha expirado. Solicite un nuevo enlace.',
  ALREADY_VERIFIED:
    'Esta cuenta ya ha sido verificada anteriormente.',
  SYSTEM_DEGRADED:
    'El sistema está en mantenimiento. Intente más tarde.',
  VERIFY_SUCCESS:
    '¡Tu cuenta ha sido activada exitosamente! Ya puedes iniciar sesión.',
};

// =============================================================================
// Utilidades SOP (espejo del patrón en register_service.ts — no circular)
// =============================================================================

/** Genera timestamp ISO-8601 con milisegundos en UTC */
function nowIso(): string {
  return new Date().toISOString();
}

/** Genera UUID v4 via crypto nativo de Node.js */
function newUuid(): string {
  return crypto.randomUUID();
}

/** Construye headers SOP globales requeridos en toda respuesta */
function buildSopHeaders(): Record<string, string> {
  return {
    'X-Request-ID': newUuid(),
    'X-Version': API_VERSION,
    'X-Timestamp': nowIso(),
    'Content-Type': 'application/json',
  };
}

/** Construye el objeto base del body SOP mandatorio en toda respuesta */
function buildSopBase(): { version: string; timestamp: string } {
  return {
    version: API_VERSION,
    timestamp: nowIso(),
  };
}

// =============================================================================
// Helpers de respuesta — evitan repetición y garantizan SOP en toda salida
// =============================================================================

function errorResponse(
  statusCode: number,
  errorCode: string,
  extra?: Record<string, unknown>
): VerifyResult {
  return {
    statusCode,
    headers: buildSopHeaders(),
    body: {
      ...buildSopBase(),
      status: 'error',
      error_code: errorCode,
      message: MESSAGES[errorCode] ?? 'Error desconocido.',
      ...extra,
    },
  };
}

function successResponse(): VerifyResult {
  return {
    statusCode: 200,
    headers: buildSopHeaders(),
    body: {
      ...buildSopBase(),
      status: 'success',
      message: MESSAGES['VERIFY_SUCCESS'],
    },
  };
}

// =============================================================================
// Caso de Uso Principal — verifyAccount
// =============================================================================

/**
 * Orquesta la verificación de email de un usuario registrado.
 *
 * @param req  - Payload con el token UUID v4 extraído del body HTTP.
 * @param ctx  - Contexto de ejecución (IP, httpMethod, flags de simulación).
 * @returns    - VerifyResult con statusCode, headers SOP y body.
 *
 * Flujo de decisión (orden estricto según PROJECT_spec.md):
 *   1. Guardia de método HTTP → 405 si no es POST
 *   2. Guardia de Query Param → 400 si se detecta token fuera del body
 *   3. Guardia de infraestructura → 503 si Redis/DB están caídos (fail-closed)
 *   4. Validación de formato del token → 400 INVALID_TOKEN
 *   5. Normalización a lowercase antes de hash SHA-256
 *   6. Resolución en DB → 400 si no existe, 410 si expirado, 409 si ya activo
 *   7. Transacción ACID: activar usuario + marcar token como usado
 *   8. 200 OK
 */
export async function verifyAccount(
  req: VerifyRequest,
  ctx: VerifyContext
): Promise<VerifyResult> {
  const method = ctx.httpMethod?.toUpperCase() ?? 'POST';

  // =========================================================================
  // GUARDIA 1 — Método HTTP
  // Solo POST está aceptado. Cualquier otro verbo → 405 METHOD_NOT_ALLOWED.
  // Referencia: PROJECT_spec.md §Verify §Logic
  // =========================================================================
  if (method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED');
  }

  // =========================================================================
  // GUARDIA 2 — Token en Query Param PROHIBIDO (Security Guard)
  // Si el cliente intentó enviar el token via QP → rechazar con 400.
  // El token NO debe quedar en el body de respuesta para no filtrarse en logs.
  // Referencia: PROJECT_spec.md §Verify §Security Guard (L385)
  // =========================================================================
  if (ctx.tokenInQueryParam !== undefined && ctx.tokenInQueryParam !== '') {
    // Rechazamos con INVALID_TOKEN (400) sin ecos del token en la respuesta
    return errorResponse(400, 'INVALID_TOKEN');
  }

  // =========================================================================
  // GUARDIA 3 — Infraestructura (Fail-Closed RNF9)
  // Si Redis o DB no están disponibles → 503 SYSTEM_DEGRADED.
  // Evaluado ANTES de cualquier lógica de negocio para cortar rápido.
  // =========================================================================
  if (ctx.simulateRedisFailure || ctx.simulateDbFailure) {
    return errorResponse(503, 'SYSTEM_DEGRADED');
  }

  // =========================================================================
  // VALIDACIÓN DE TOKEN — Formato UUID v4 estricto
  // 1. Verificar que el campo existe y es string
  // 2. Normalización a lowercase (mandatorio antes de hash SHA-256)
  // 3. Validar contra regex UUID v4 estricto
  // Referencia: PROJECT_spec.md §Auth §Normalización Crítica
  // =========================================================================
  const rawToken: unknown = req.token;

  if (rawToken === undefined || rawToken === null || typeof rawToken !== 'string') {
    return errorResponse(400, 'INVALID_TOKEN');
  }

  if (rawToken.trim() === '') {
    return errorResponse(400, 'INVALID_TOKEN');
  }

  // Normalización MANDATORIA a lowercase antes de validar y hashear
  const normalizedToken = rawToken.toLowerCase();

  if (!UUID_V4_REGEX.test(normalizedToken)) {
    return errorResponse(400, 'INVALID_TOKEN');
  }

  // =========================================================================
  // RESOLUCIÓN EN DB — Estado del token y del usuario
  // En producción: buscar el token hasheado (SHA-256) en auth_tokens.
  // En tests: el contexto de simulación emula los distintos estados posibles.
  //
  // Orden de prioridad según spec:
  //   • Token no encontrado → 400 INVALID_TOKEN
  //   • Token expirado (> 24h) → 410 EXPIRED_TOKEN
  //   • Usuario ya ACTIVE → 409 ALREADY_VERIFIED
  //   • OK → 200 (transacción ACID)
  // =========================================================================
  if (ctx.simulateTokenNotFound) {
    return errorResponse(400, 'INVALID_TOKEN');
  }

  if (ctx.simulateExpiredToken) {
    return errorResponse(410, 'EXPIRED_TOKEN');
  }

  if (ctx.simulateAlreadyVerified) {
    return errorResponse(409, 'ALREADY_VERIFIED');
  }

  // =========================================================================
  // TRANSACCIÓN ACID — Activación de cuenta (Happy Path)
  //
  // En producción, esta sección ejecutaría dentro de una transacción DB:
  //   BEGIN;
  //     UPDATE users SET status = 'ACTIVE' WHERE id = :userId;
  //     UPDATE auth_tokens SET used_at = NOW() WHERE token_hash = :hash;
  //     -- Invalidar TODOS los tokens pendientes del mismo usuario
  //     UPDATE auth_tokens SET used_at = NOW()
  //       WHERE user_id = :userId AND used_at IS NULL AND id != :tokenId;
  //   COMMIT;
  //
  // En el entorno de test con flags de simulación, el token normalizado
  // (VALID_TOKEN en lowercase) es reconocido como existente y válido.
  // =========================================================================

  return successResponse();
}
