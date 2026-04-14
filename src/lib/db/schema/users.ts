/**
 * users.ts — Esquema de dominio para la tabla public.users
 * Trazabilidad: TSK-I2-B01-G1 — Auth Persistence Impl
 * Agente: backend-coder
 *
 * Responsabilidad: Definir los tipos TypeScript puros del modelo User.
 * Nota: Sin imports de drizzle-orm — la integración ORM ocurre en una tarea posterior.
 * El estado por defecto de un usuario recién creado es 'UNVERIFIED'.
 * El campo birthdate usa string YYYY-MM-DD (Plain-Date) para evitar timezone drift.
 */

// =============================================================================
// Tipos de dominio — Enum UserStatus
// =============================================================================

/**
 * Estado del ciclo de vida de un usuario.
 * - 'UNVERIFIED': cuenta creada pero email no confirmado (default al registrar)
 * - 'ACTIVE': email verificado, cuenta operativa
 */
export type UserStatus = 'UNVERIFIED' | 'ACTIVE';

// =============================================================================
// Interfaz principal — User
// =============================================================================

/**
 * Contrato de dominio para un registro en public.users.
 * Todos los campos reflejan estrictamente el esquema autorizado en PROJECT_spec.md.
 */
export interface User {
  /** UUID v4 — identificador primario del usuario */
  id: string;

  /** Email único en minúsculas — índice único en la tabla */
  email: string;

  /** Hash Argon2id del password — nunca se almacena texto plano */
  password: string;

  /**
   * Fecha de nacimiento en formato YYYY-MM-DD (Plain-Date string).
   * Se almacena como string para evitar timezone drift al convertir a Date.
   */
  birthdate: string;

  /**
   * Estado del ciclo de vida del usuario.
   * Valor por defecto al crear: 'UNVERIFIED'
   */
  status: UserStatus;

  /**
   * Soft-delete: null = cuenta activa, Date = fecha en que se solicitó la baja.
   * Tras 30 días de gracia se ejecuta el Hard Delete (purga física).
   */
  deleted_at: Date | null;

  /** Timestamp de creación del registro */
  created_at: Date;

  /** Timestamp de la última modificación */
  updated_at: Date;
}
