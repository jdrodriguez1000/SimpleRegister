/**
 * types/health.ts — Contratos de Tipos Frontend: Health Dashboard
 *
 * Fuente de verdad para el consumidor frontend del endpoint /api/v1/health.
 * Refleja 1:1 los contratos definidos en PROJECT_spec.md (Sección Frontend).
 *
 * Trazabilidad: TSK-I1-F01-G | Iteración 1 — Bloque 4
 * Agente: frontend-coder
 *
 * Principio: Este módulo es independiente de src/lib (capa de servicios backend).
 * Los tipos aquí son el contrato del CONSUMIDOR, no del proveedor.
 */

// =============================================================================
// Tipos Atómicos — PROJECT_spec.md §Definición de Tipos
// =============================================================================

/** Estado de conexión de un servicio crítico (database, redis) */
export type ConnectionStatus = 'connected' | 'disconnected';

/** Estado de configuración de un servicio no crítico (email, captcha) */
export type ConfigStatus = 'config_valid' | 'error';

/** Identificadores canónicos de las 4 dependencias del sistema */
export type ServiceName = 'database' | 'redis' | 'email_service' | 'captcha_service';

// =============================================================================
// HealthCheckResponse — Discriminated Union (spec §Response Schemas)
// =============================================================================

/**
 * Respuesta discriminada del endpoint GET /api/v1/health.
 *
 * Rama "healthy":
 *   - Modo público: solo status, version, timestamp.
 *   - Modo privado (X-Health-Key válida): agrega performance + dependencies.
 *
 * Rama "unhealthy":
 *   - Cubre HTTP 400, 403, 406, 429, 503.
 *   - error_code es el discriminador semántico para mapear acciones UI.
 */
export type HealthCheckResponse =
  | {
      status: 'healthy';
      version: string;
      timestamp: string;
      /** Solo presente en modo privado (X-Health-Key válida) */
      performance?: {
        api_latency_ms: number;
        latency_type: string;
      };
      /** Solo presente en modo privado (X-Health-Key válida) */
      dependencies?: {
        database: ConnectionStatus;
        redis: ConnectionStatus;
        email_service: ConfigStatus;
        captcha_service: ConfigStatus;
      };
    }
  | {
      status: 'unhealthy';
      version: string;
      timestamp: string;
      error_code:
        | 'MALFORMED_REQUEST'        // HTTP 400 — X-Health-Key con formato inválido
        | 'AUTH_REQUIRED'            // HTTP 403 — Llave incorrecta o expirada
        | 'RATE_LIMIT_EXCEEDED'      // HTTP 429 — Límite de 10 req/min superado
        | 'SYSTEM_DEGRADED'          // HTTP 503 — DB o Redis caídos
        | 'CONTENT_TYPE_NOT_SUPPORTED'; // HTTP 406 — Accept header inválido
      message: string;
      /** Presente solo en SYSTEM_DEGRADED — lista los servicios críticos caídos */
      unhealthy_services?: ServiceName[];
    };

// =============================================================================
// Tipos de UI — Estados de la Máquina de Interfaz (spec §Manejo de Estados UI)
// =============================================================================

/**
 * Estados del ciclo de vida del dashboard de salud.
 *
 * - idle:    Estado inicial. Pantalla "Initializing System...".
 * - loading: Petición en curso. Skeleton Loaders activos.
 * - success: Respuesta recibida. Dashboard con indicadores de estado.
 * - error:   Fallo de red o API. Banner persistente + botón de reintento.
 */
export type HealthUIState = 'idle' | 'loading' | 'success' | 'error';

// =============================================================================
// Tipos de UI — Niveles SLA (spec §Criterios de Degradación)
// =============================================================================

/**
 * Nivel de rendimiento según la latencia de la API.
 *
 * - green:    api_latency_ms < 200ms   → Indicadores verdes.
 * - warning:  200ms ≤ latency < 500ms  → Indicadores amarillos.
 * - critical: api_latency_ms ≥ 500ms   → Indicadores rojos (200 OK pero degradado).
 */
export type SLALevel = 'green' | 'warning' | 'critical';
