/**
 * i18n.ts — Resolución de idioma por header Accept-Language
 * Trazabilidad: TSK-I2-B01-G2 — Security & I18N Utils
 * Agente: backend-coder
 *
 * Responsabilidad única: parsear el header Accept-Language (RFC 5646) y retornar
 * el idioma soportado más apropiado. Siempre hace fallback a 'es' ante cualquier
 * error, header inválido o idioma no soportado.
 *
 * Convenciones:
 *   - Matching por prefijo: 'es-AR' hace match con 'es' en la lista de soportados.
 *   - Ordena candidatos por q-value (mayor q-value = mayor prioridad).
 *   - Nunca lanza excepciones — diseñado para ser fail-safe en producción.
 *   - CLAUDE.md §Convenciones: UI/Salida al usuario → Español. Fallback mandatorio: 'es'.
 */

// =============================================================================
// Constante de fallback
// =============================================================================

/** Idioma por defecto mandatorio según CLAUDE.md y PROJECT_spec.md */
const FALLBACK_LANGUAGE = 'es';

// =============================================================================
// Tipos internos
// =============================================================================

/** Candidato de idioma con su q-value asociado */
interface LanguageCandidate {
  tag: string;
  q: number;
}

// =============================================================================
// Lógica pública
// =============================================================================

/**
 * Resuelve el idioma preferido del usuario según el header Accept-Language.
 *
 * @param header    - Valor del header Accept-Language (puede ser null/undefined/'')
 * @param supported - Lista de idiomas soportados (readonly string[])
 * @returns El código de idioma soportado más apropiado, o 'es' como fallback final
 *
 * Ejemplos:
 *   resolveLanguage('ja,fr;q=0.9,es;q=0.8', ['es']) → 'es'
 *   resolveLanguage('es-AR', ['es'])                 → 'es'
 *   resolveLanguage(null, ['es'])                    → 'es'
 *   resolveLanguage('invalid!!!', ['es'])            → 'es'
 */
export function resolveLanguage(
  header: string | null | undefined,
  supported: readonly string[]
): string {
  // ---- Fallback temprano ante header vacío o ausente ----
  if (!header || header.trim() === '') {
    return supported[0] ?? FALLBACK_LANGUAGE;
  }

  try {
    // ---- Parsear el header según RFC 5646 ----
    // Formato: "ja,fr;q=0.9,es;q=0.8" o "es-AR" o "es"
    const candidates: LanguageCandidate[] = header
      .split(',')
      .map((segment) => {
        const parts = segment.trim().split(';');
        const tag = parts[0].trim();

        // Extraer q-value (default: 1.0 si no se especifica)
        let q = 1.0;
        for (const param of parts.slice(1)) {
          const [key, value] = param.trim().split('=');
          if (key.trim().toLowerCase() === 'q' && value) {
            const parsed = parseFloat(value.trim());
            if (!isNaN(parsed)) {
              q = parsed;
            }
          }
        }

        return { tag, q };
      })
      // Filtrar entradas sin tag válido
      .filter((c) => c.tag.length > 0);

    // ---- Ordenar por q-value descendente (mayor prioridad primero) ----
    candidates.sort((a, b) => b.q - a.q);

    // ---- Intentar match por prefijo de idioma base ----
    for (const candidate of candidates) {
      // Extraer el prefijo de idioma base (ej: 'es' de 'es-AR')
      const baseTag = candidate.tag.split('-')[0].toLowerCase();

      for (const lang of supported) {
        if (lang.toLowerCase() === baseTag) {
          return lang;
        }
      }
    }
  } catch {
    // Headers malformados nunca deben romper el sistema
    // Caer al fallback final
  }

  // ---- Fallback mandatorio a 'es' ----
  return FALLBACK_LANGUAGE;
}
