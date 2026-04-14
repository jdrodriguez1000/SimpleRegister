/**
 * log_sanitizer.ts — Sanitizador de datos sensibles para logs
 * Trazabilidad: TSK-I2-B01-RF — Security Hardening
 * Agente: backend-coder
 *
 * Responsabilidad única: interceptar objetos de log y enmascarar los campos
 * que contienen información sensible antes de que lleguen a Pino o cualquier
 * sink de logging.
 *
 * Campos enmascarados (configurados por la spec):
 *   - 'password'      → '***'
 *   - 'token'         → '***'
 *   - 'token_hash'    → '***'
 *   - 'authorization' → '***'
 *
 * Garantías:
 *   - No muta el objeto original — retorna una copia plana.
 *   - Campos no sensibles se copian sin modificación.
 *   - Diseñado para ser fail-safe: nunca lanza excepciones.
 */

// =============================================================================
// Constantes de dominio
// =============================================================================

/** Conjunto de campos que deben ser enmascarados en los logs */
const SENSITIVE_FIELDS = new Set<string>([
  'password',
  'token',
  'token_hash',
  'authorization',
]);

/** Valor de reemplazo para campos sensibles */
const MASK_VALUE = '***';

// =============================================================================
// Lógica pública de sanitización
// =============================================================================

/**
 * Retorna una copia del objeto de log con los campos sensibles enmascarados.
 * No modifica el objeto original (inmutabilidad).
 *
 * @param data - Objeto plano de datos para log
 * @returns Nuevo objeto con campos sensibles reemplazados por '***'
 *
 * Ejemplo:
 *   sanitizeLogData({ email: 'a@b.com', password: 'secret123' })
 *   → { email: 'a@b.com', password: '***' }
 */
export function sanitizeLogData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      sanitized[key] = MASK_VALUE;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
