/**
 * token_hash.ts — Hashing SHA-256 de tokens para persistencia segura
 * Trazabilidad: TSK-I2-B01-RF — Security Hardening
 * Agente: backend-coder
 *
 * Responsabilidad única: generar el hash SHA-256 de un token de autenticación
 * normalizado a lowercase antes del hash, para prevenir colisiones por casing
 * y garantizar que el token almacenado en DB nunca sea el valor en claro.
 *
 * Contrato crítico (PROJECT_spec.md):
 *   1. Normalizar a lowercase ANTES del hash.
 *   2. Retornar el hex string de 64 caracteres del SHA-256.
 */

import { createHash } from 'crypto';

// =============================================================================
// Lógica pública de hashing
// =============================================================================

/**
 * Genera el hash SHA-256 de un token, normalizando a lowercase antes del hash.
 *
 * @param rawToken - Token en texto plano (ej: UUID v4, puede ser mayúsculas)
 * @returns Hex string de 64 caracteres (SHA-256)
 *
 * Ejemplo:
 *   hashToken('A3F1B2C4-E5F6-4A7B-8C9D-E0F1A2B3C4D5')
 *   → sha256('a3f1b2c4-e5f6-4a7b-8c9d-e0f1a2b3c4d5')
 *   → '...(64 hex chars)...'
 */
export function hashToken(rawToken: string): string {
  // Normalización a lowercase — prevención de colisiones por casing
  const normalizedToken = rawToken.toLowerCase();

  return createHash('sha256')
    .update(normalizedToken, 'utf8')
    .digest('hex');
}
