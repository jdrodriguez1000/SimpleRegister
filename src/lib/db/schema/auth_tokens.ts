/**
 * auth_tokens.ts — Esquema de dominio para la tabla public.auth_sessions / auth_tokens
 * Trazabilidad: TSK-I2-B01-G1 — Auth Persistence Impl
 * Agente: backend-coder
 *
 * Responsabilidad: Definir los tipos TypeScript puros del modelo AuthToken.
 * Nota: Sin imports de drizzle-orm — la integración ORM ocurre en una tarea posterior.
 * El campo token_hash almacena el SHA-256 hex (64 chars) del token normalizado a lowercase.
 * El campo expires_at se calcula como created_at + 24h para tokens de verificación de email.
 */

// =============================================================================
// Interfaz principal — AuthToken
// =============================================================================

/**
 * Contrato de dominio para un registro de token de autenticación/verificación.
 * Todos los campos reflejan estrictamente el esquema autorizado en PROJECT_spec.md.
 */
export interface AuthToken {
  /** UUID v4 — identificador primario del token */
  id: string;

  /**
   * FK → public.users.id — UUID v4 del usuario propietario del token.
   * Relación 1:1 con el usuario durante el periodo de verificación.
   */
  user_id: string;

  /**
   * Hash SHA-256 (hex, 64 chars) del token normalizado a lowercase.
   * Nunca se almacena el token en claro — previene ataques de acceso a DB.
   */
  token_hash: string;

  /**
   * Timestamp de expiración del token.
   * Para verificación de email: created_at + 24 horas (límite inclusive).
   */
  expires_at: Date;

  /** Timestamp de creación del token */
  created_at: Date;
}
