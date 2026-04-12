/**
 * health_types.ts — Tipos Compartidos del Dominio Health
 * Trazabilidad: TSK-I1-B02-C — Corrección de dependencia circular (Revisión Reviewer)
 *
 * Resolucion de arquitectura:
 *   ANTES: sop_response.ts → health_service.ts → sop_response.ts (ciclo de import type)
 *   AHORA: sop_response.ts → health_types.ts ← health_service.ts (flujo unidireccional)
 *
 * Principio aplicado: tipos compartidos pertenecen a la capa mas baja (tipos puro),
 * no a los modulos que los usan.
 */

/** Estado de conexion de un servicio critico (DB, Redis) */
export type ConnectionStatus = 'connected' | 'disconnected';

/** Estado de configuracion de un servicio no critico (Email, Captcha) */
export type ConfigStatus = 'config_valid' | 'error';

/** Identificadores canónicos de las dependencias del sistema */
export type ServiceName = 'database' | 'redis' | 'email_service' | 'captcha_service';

/** Catalogo de codigos de error SOP — espejo del union type en PROJECT_spec.md */
export type ErrorCode =
  | 'MALFORMED_REQUEST'
  | 'AUTH_REQUIRED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SYSTEM_DEGRADED'
  | 'CONTENT_TYPE_NOT_SUPPORTED';

/** Estado consolidado de todas las dependencias — producido por health_service */
export interface DependencyStatus {
  database: ConnectionStatus;
  redis: ConnectionStatus;
  email_service: ConfigStatus;
  captcha_service: ConfigStatus;
}
