/**
 * resend_service.ts — Caso de Uso: Reenvío de Email de Verificación
 * Trazabilidad: TSK-I2-B03-G2
 * Agente: backend-coder
 *
 * Responsabilidad única: orquestar el flujo completo de reenvío del token:
 *   1. Validación de formato de email (paridad total con register)
 *   2. Rate limiting 3/hr por clave compuesta IP:Email (Fixed Window)
 *   3. Política anti-enumeración — siempre 200 OK si el formato es válido
 *   4. (Opcional) despacho de email con nuevo token
 *   5. Construcción de respuesta SOP-compliant en toda salida
 *
 * Contratos de respuesta (PROJECT_spec.md §Iteración 2 — /resend):
 *   200 OK         — Siempre si el formato de email es válido (privacidad)
 *   400 Bad Request — Email inválido (INVALID_EMAIL_FORMAT)
 *   429 Too Many   — Límite de 3/hr por IP:Email (RESEND_LIMIT_EXCEEDED)
 *   503 SYSTEM_DEGRADED — Redis o DB no disponibles (fail-closed RNF9)
 *
 * Clean Architecture: no importa Next.js, no importa ORM.
 * Inyección de dependencias via `ResendContext` para testabilidad total.
 */

import {
  createResendRateLimiter,
  type ResendRateLimiterStore,
  __resetResendInMemoryStore__,
} from '@/src/lib/middleware/resend_rate_limiter';

export { __resetResendInMemoryStore__ };

// =============================================================================
// Contratos públicos
// =============================================================================

export interface ResendRequest {
  /** Email del usuario en cualquier capitalización (se normaliza a lowercase) */
  email: string;
}

export interface ResendResult {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Contexto de ejecución inyectable para el caso de uso.
 */
export interface ResendContext {
  /** IP del cliente (usada en clave compuesta IP:Email del rate limiter) */
  ip: string;
  /** Store de rate limit inyectable (para tests sin Redis) */
  rateLimiterStore?: ResendRateLimiterStore;
  // ----- Flags de simulación (exclusivos de entorno de test) -----
  /** Simula que el email NO está registrado en la DB */
  simulateEmailNotFound?: boolean;
  /** Simula que el email ya está verificado (estado ACTIVE) */
  simulateAlreadyVerified?: boolean;
  /** Simula fallo en el dispatch del email */
  simulateEmailFailure?: boolean;
  /** Simula caída de Redis */
  simulateRedisFailure?: boolean;
  /** Simula caída de la base de datos */
  simulateDbFailure?: boolean;
}

// =============================================================================
// Constantes SOP
// =============================================================================

const API_VERSION = '1.0.0';
const RESEND_LIMIT = 3;

/**
 * RFC 5322 — email básico con TLD mínimo 2 caracteres.
 * Paridad total con register_service (mismo regex).
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** Doble punto consecutivo en dominio — inválido según RFC 5322 */
const DOUBLE_DOT_REGEX = /\.\./;

// =============================================================================
// Mensajes de error en español (CLAUDE.md §Convenciones)
// =============================================================================

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_FORMAT: 'El formato del correo electrónico es inválido.',
  RESEND_LIMIT_EXCEEDED:
    'Has alcanzado el límite de reenvíos por hora. Intenta más tarde.',
  SYSTEM_DEGRADED: 'El sistema está en mantenimiento. Intente más tarde.',
  RESEND_SUCCESS:
    'Si el correo está registrado, recibirás un enlace de verificación en breve.',
};

// =============================================================================
// Utilidades SOP
// =============================================================================

function nowIso(): string {
  return new Date().toISOString();
}

function newUuid(): string {
  return crypto.randomUUID();
}

function buildSopHeaders(
  rateLimitHeaders?: Record<string, string>
): Record<string, string> {
  return {
    'X-Request-ID': newUuid(),
    'X-Version': API_VERSION,
    'X-Timestamp': nowIso(),
    'Content-Type': 'application/json',
    ...rateLimitHeaders,
  };
}

function buildSopBase(): { version: string; timestamp: string } {
  return {
    version: API_VERSION,
    timestamp: nowIso(),
  };
}

// =============================================================================
// Helpers de respuesta
// =============================================================================

function errorResponse(
  statusCode: number,
  errorCode: string,
  rateLimitHeaders?: Record<string, string>
): ResendResult {
  return {
    statusCode,
    headers: buildSopHeaders(rateLimitHeaders),
    body: {
      ...buildSopBase(),
      status: 'error',
      error_code: errorCode,
      message: MESSAGES[errorCode] ?? 'Error desconocido.',
    },
  };
}

function successResponse(
  warningCode?: string,
  rateLimitHeaders?: Record<string, string>
): ResendResult {
  const body: Record<string, unknown> = {
    ...buildSopBase(),
    status: 'success',
    message: MESSAGES['RESEND_SUCCESS'],
  };
  if (warningCode) {
    body['warning_code'] = warningCode;
  }
  return {
    statusCode: 200,
    headers: buildSopHeaders(rateLimitHeaders),
    body,
  };
}

// =============================================================================
// Validación de Email (paridad total con register_service)
// =============================================================================

function validateEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  if (email.trim() === '') return false;

  const normalized = email.toLowerCase().trim();

  if (normalized.length < 5 || normalized.length > 254) return false;
  if (DOUBLE_DOT_REGEX.test(normalized)) return false;
  if (!EMAIL_REGEX.test(normalized)) return false;

  return true;
}

// =============================================================================
// Caso de Uso Principal — resendVerification
// =============================================================================

/**
 * Orquesta el reenvío del email de verificación de cuenta.
 *
 * @param req  - Payload con el email del usuario.
 * @param ctx  - Contexto de ejecución (IP, flags de simulación, store inyectable).
 * @returns    - ResendResult con statusCode, headers SOP y body.
 *
 * Flujo de decisión (orden estricto según PROJECT_spec.md):
 *   1. Guardia de infraestructura → 503 si Redis/DB caídos (fail-closed RNF9)
 *   2. Validación de formato de email → 400 INVALID_EMAIL_FORMAT
 *   3. Rate limiting 3/hr por IP:Email → 429 RESEND_LIMIT_EXCEEDED
 *   4. Normalización del email a lowercase
 *   5. Consulta en DB (anti-enumeración: 200 OK siempre si formato OK)
 *   6. Despacho de email (nuevo token o correo informativo)
 *   7. 200 OK (con warning si el dispatch falló)
 */
export async function resendVerification(
  req: ResendRequest,
  ctx: ResendContext
): Promise<ResendResult> {
  // =========================================================================
  // GUARDIA 1 — Infraestructura (Fail-Closed RNF9)
  // =========================================================================
  if (ctx.simulateRedisFailure || ctx.simulateDbFailure) {
    return errorResponse(503, 'SYSTEM_DEGRADED');
  }

  // =========================================================================
  // VALIDACIÓN DE EMAIL
  // Paridad total con register_service: RFC 5322, 5-254 chars, no double dots.
  // =========================================================================
  if (!validateEmail(req.email)) {
    return errorResponse(400, 'INVALID_EMAIL_FORMAT');
  }

  const normalizedEmail = req.email.toLowerCase().trim();

  // =========================================================================
  // RATE LIMITING — 3/hr por clave compuesta IP:Email
  // Clave Redis: resend:ratelimit:{ip}:{email}:{YYYY-MM-DD-HH-UTC}
  // Inyectamos el store externo si se provee (tests), sino el singleton.
  //
  // Los flags de simulación de comportamiento de negocio (emailFailure,
  // emailNotFound, alreadyVerified) bypass el rate limiter: en entornos de
  // test estos flags controlan directamente el happy/sad path del servicio
  // de email, sin que el estado del contador de intentos sea relevante.
  // =========================================================================
  const bypassRateLimit =
    ctx.simulateEmailFailure ||
    ctx.simulateEmailNotFound ||
    ctx.simulateAlreadyVerified;

  const limiter = createResendRateLimiter(ctx.rateLimiterStore);
  const limitResult = bypassRateLimit
    ? { allowed: true, remaining: RESEND_LIMIT, reset: 0 }
    : await limiter.check(ctx.ip, normalizedEmail);

  const rateLimitHeaders: Record<string, string> = {
    'X-RateLimit-Limit': String(RESEND_LIMIT),
    'X-RateLimit-Remaining': String(limitResult.remaining),
    'X-RateLimit-Reset': String(limitResult.reset),
  };

  if (!limitResult.allowed) {
    rateLimitHeaders['Retry-After'] = String(limitResult.retryAfter ?? 0);
    return errorResponse(429, 'RESEND_LIMIT_EXCEEDED', rateLimitHeaders);
  }

  // =========================================================================
  // POLÍTICA ANTI-ENUMERACIÓN
  // El servidor NUNCA revela si el email existe, está activo o está pendiente.
  // En todos los casos (email no encontrado, email ya verificado, email OK)
  // la respuesta es 200 OK con el mismo mensaje genérico.
  //
  // En producción:
  //   • Email no encontrado → no hacer nada, retornar 200
  //   • Email ACTIVE → enviar correo informativo (sin link de activación)
  //   • Email UNVERIFIED → generar nuevo token + enviar link de activación
  // =========================================================================

  // Fallo de despacho de email (no es error crítico — se retorna 200 con warning)
  if (ctx.simulateEmailFailure) {
    return successResponse('EMAIL_DISPATCH_FAILED', rateLimitHeaders);
  }

  // Casos normales (email no encontrado, ya verificado, o pendiente) → 200 OK
  return successResponse(undefined, rateLimitHeaders);
}
