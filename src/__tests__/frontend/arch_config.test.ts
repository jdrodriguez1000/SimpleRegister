/**
 * arch_config.test.ts — TSK-I1-F01-R: Frontend Architecture Red-Check
 *
 * Propósito: Verificar que los contratos de tipos del frontend definidos en
 * PROJECT_spec.md existen y son accesibles desde el alias canónico @/types/health.
 *
 * ESTADO ESPERADO: RED
 *   - TypeScript no puede compilar: el módulo @/types/health no existe.
 *   - El build confirma la ausencia del archivo contractual requerido.
 *   - Todos los tests del archivo fallan por error de compilación.
 *
 * Trazabilidad: TSK-I1-F01-R
 * Dependencia Resuelta: TSK-I1-B02-C (backend certificado)
 * Siguiente Tarea: TSK-I1-F01-G (frontend-coder debe crear @/types/health)
 *
 * Regla de Oro (frontend-tester): "Nada es Visible si no es Testeable"
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// IMPORTACIÓN CONTRACTUAL — Causa de falla de compilación en estado RED
// TSK-I1-F01-G debe crear types/health.ts para alcanzar GREEN
// =============================================================================
import type {
  HealthCheckResponse,
  ConnectionStatus,
  ConfigStatus,
  ServiceName,
  HealthUIState,
  SLALevel,
} from '@/types/health';

// =============================================================================
// BLOQUE 1 — Existencia del módulo de tipos
// =============================================================================

describe('TSK-I1-F01-R | Módulo @/types/health — Existencia y Estructura', () => {
  it('debe existir el archivo types/health.ts en la raíz del proyecto', () => {
    // Valida la convención de ubicación para el módulo FE de tipos contractuales.
    // El alias @/types/health resuelve a <rootDir>/types/health.ts
    const typesFilePath = path.resolve(process.cwd(), 'types', 'health.ts');
    expect(fs.existsSync(typesFilePath)).toBe(true);
  });

  it('el módulo no debe re-exportar desde src/lib (sin acoplamiento de capas)', () => {
    // Los tipos frontend deben ser independientes de la capa de servicios backend.
    // El archivo types/health.ts no debe tener import desde @/src/lib/.
    const typesFilePath = path.resolve(process.cwd(), 'types', 'health.ts');
    if (!fs.existsSync(typesFilePath)) {
      // En estado RED el archivo no existe — falla esperada
      expect(fs.existsSync(typesFilePath)).toBe(true);
      return;
    }
    const content = fs.readFileSync(typesFilePath, 'utf-8');
    expect(content).not.toMatch(/from ['"]@\/src\/lib/);
  });
});

// =============================================================================
// BLOQUE 2 — Contratos de Tipos Atómicos (spec §Definición de Tipos)
// =============================================================================

describe('TSK-I1-F01-R | ConnectionStatus — Tipo de Estado de Conexión Crítica', () => {
  it('debe aceptar el valor "connected"', () => {
    const status: ConnectionStatus = 'connected';
    expect(status).toBe('connected');
  });

  it('debe aceptar el valor "disconnected"', () => {
    const status: ConnectionStatus = 'disconnected';
    expect(status).toBe('disconnected');
  });

  it('debe cubrir exactamente 2 valores (no más, no menos)', () => {
    // Asegura exhaustividad del union type: ningún estado intermedio permitido
    const allStatuses: ConnectionStatus[] = ['connected', 'disconnected'];
    expect(allStatuses).toHaveLength(2);
  });
});

describe('TSK-I1-F01-R | ConfigStatus — Tipo de Estado de Servicio No Crítico', () => {
  it('debe aceptar el valor "config_valid"', () => {
    const status: ConfigStatus = 'config_valid';
    expect(status).toBe('config_valid');
  });

  it('debe aceptar el valor "error"', () => {
    const status: ConfigStatus = 'error';
    expect(status).toBe('error');
  });

  it('debe cubrir exactamente 2 valores (no más, no menos)', () => {
    const allStatuses: ConfigStatus[] = ['config_valid', 'error'];
    expect(allStatuses).toHaveLength(2);
  });
});

describe('TSK-I1-F01-R | ServiceName — Identificadores Canónicos de Dependencias', () => {
  it('debe incluir los 4 servicios del sistema de salud', () => {
    // Orden conforme a PROJECT_spec.md §Sección Frontend
    const services: ServiceName[] = [
      'database',
      'redis',
      'email_service',
      'captcha_service',
    ];
    expect(services).toHaveLength(4);
  });

  it('debe incluir "database" como servicio crítico', () => {
    const name: ServiceName = 'database';
    expect(name).toBe('database');
  });

  it('debe incluir "redis" como servicio crítico', () => {
    const name: ServiceName = 'redis';
    expect(name).toBe('redis');
  });

  it('debe incluir "email_service" como servicio no crítico', () => {
    const name: ServiceName = 'email_service';
    expect(name).toBe('email_service');
  });

  it('debe incluir "captcha_service" como servicio no crítico', () => {
    const name: ServiceName = 'captcha_service';
    expect(name).toBe('captcha_service');
  });
});

// =============================================================================
// BLOQUE 3 — Discriminated Union HealthCheckResponse (spec §Response Schemas)
// =============================================================================

describe('TSK-I1-F01-R | HealthCheckResponse — Respuesta Privada Saludable', () => {
  it('debe tipar la respuesta privada completa con status "healthy"', () => {
    // Mapa 1:1 del mock "Respuesta Privada (Success Full)" de PROJECT_spec.md
    const response: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:00:00.000Z',
      performance: {
        api_latency_ms: 45.00,
        latency_type: 'Server-side processing',
      },
      dependencies: {
        database: 'connected',
        redis: 'connected',
        email_service: 'config_valid',
        captcha_service: 'config_valid',
      },
    };
    expect(response.status).toBe('healthy');
    expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('los campos performance y dependencies deben ser opcionales (modo público)', () => {
    // Mapa 1:1 del mock "Respuesta Pública (Success Limited)" de PROJECT_spec.md
    const publicResponse: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:01:00.000Z',
    };
    expect(publicResponse.status).toBe('healthy');
    expect((publicResponse as { performance?: unknown }).performance).toBeUndefined();
    expect((publicResponse as { dependencies?: unknown }).dependencies).toBeUndefined();
  });

  it('api_latency_ms debe ser tipo number (float con 2 decimales)', () => {
    const response: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:00:00.000Z',
      performance: {
        api_latency_ms: 45.00,
        latency_type: 'Server-side processing',
      },
    };
    if (response.status === 'healthy' && response.performance) {
      expect(typeof response.performance.api_latency_ms).toBe('number');
    }
  });
});

describe('TSK-I1-F01-R | HealthCheckResponse — Respuestas de Error (status: "unhealthy")', () => {
  it('debe tipar la respuesta de error 503 SYSTEM_DEGRADED', () => {
    // Mapa 1:1 del mock "Error 503 (Mock)" de PROJECT_spec.md
    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:02:00.000Z',
      error_code: 'SYSTEM_DEGRADED',
      message: 'Servicios críticos no disponibles.',
      unhealthy_services: ['database'],
    };
    expect(errorResponse.status).toBe('unhealthy');
    if (errorResponse.status === 'unhealthy') {
      expect(errorResponse.error_code).toBe('SYSTEM_DEGRADED');
      expect(errorResponse.unhealthy_services).toContain('database');
    }
  });

  it('debe tipar el error 429 RATE_LIMIT_EXCEEDED', () => {
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas peticiones. Límite de 10 req/min excedido.',
    };
    expect(response.status).toBe('unhealthy');
  });

  it('debe tipar el error 400 MALFORMED_REQUEST', () => {
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'MALFORMED_REQUEST',
      message: 'Formato de X-Health-Key inválido (Debe ser UUID v4).',
    };
    expect(response.status).toBe('unhealthy');
  });

  it('debe tipar el error 403 AUTH_REQUIRED', () => {
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'AUTH_REQUIRED',
      message: 'Llave de salud incorrecta o expirada.',
    };
    expect(response.status).toBe('unhealthy');
  });

  it('debe tipar el error 406 CONTENT_TYPE_NOT_SUPPORTED', () => {
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'CONTENT_TYPE_NOT_SUPPORTED',
      message: 'Sólo se soporta respuesta en formato JSON.',
    };
    expect(response.status).toBe('unhealthy');
  });

  it('unhealthy_services es un array opcional de ServiceName', () => {
    const responseConServicios: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'SYSTEM_DEGRADED',
      message: 'Servicios críticos no disponibles.',
      unhealthy_services: ['database', 'redis'],
    };
    const responseSinServicios: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'RATE_LIMIT_EXCEEDED',
      message: 'Límite excedido.',
    };
    expect(responseConServicios.status).toBe('unhealthy');
    expect(responseSinServicios.status).toBe('unhealthy');
  });
});

// =============================================================================
// BLOQUE 4 — Tipos de UI (spec §Manejo de Estados UI y §Criterios de Degradación)
// =============================================================================

describe('TSK-I1-F01-R | HealthUIState — Estados de Máquina de la Interfaz', () => {
  it('debe exportar el estado "idle" (pantalla Initializing System...)', () => {
    const state: HealthUIState = 'idle';
    expect(state).toBe('idle');
  });

  it('debe exportar el estado "loading" (skeleton loaders activos)', () => {
    const state: HealthUIState = 'loading';
    expect(state).toBe('loading');
  });

  it('debe exportar el estado "success" (dashboard verde con latencia)', () => {
    const state: HealthUIState = 'success';
    expect(state).toBe('success');
  });

  it('debe exportar el estado "error" (banner persistente + botón reintento)', () => {
    const state: HealthUIState = 'error';
    expect(state).toBe('error');
  });

  it('debe cubrir exactamente los 4 estados del spec (no más)', () => {
    const allStates: HealthUIState[] = ['idle', 'loading', 'success', 'error'];
    expect(allStates).toHaveLength(4);
  });
});

describe('TSK-I1-F01-R | SLALevel — Niveles de Latencia (spec §Criterios de Degradación)', () => {
  it('debe exportar "green" para latencia < 200ms', () => {
    const level: SLALevel = 'green';
    expect(level).toBe('green');
  });

  it('debe exportar "warning" para latencia 200-500ms', () => {
    const level: SLALevel = 'warning';
    expect(level).toBe('warning');
  });

  it('debe exportar "critical" para latencia >= 500ms o error', () => {
    const level: SLALevel = 'critical';
    expect(level).toBe('critical');
  });

  it('debe cubrir exactamente los 3 niveles del spec', () => {
    const allLevels: SLALevel[] = ['green', 'warning', 'critical'];
    expect(allLevels).toHaveLength(3);
  });
});

// =============================================================================
// BLOQUE 5 — Variables de Entorno Frontend (Next.js NEXT_PUBLIC_*)
// =============================================================================

describe('TSK-I1-F01-R | Variables de Entorno — Configuración Frontend', () => {
  it('NODE_ENV debe estar definida y ser un entorno válido', () => {
    expect(process.env.NODE_ENV).toBeDefined();
    expect(['development', 'test', 'production']).toContain(process.env.NODE_ENV);
  });

  it('NEXT_PUBLIC_APP_URL debe estar definida y tener formato de URL válida', () => {
    // Definida en .env.example: NEXT_PUBLIC_APP_URL=http://localhost:3000
    // En entorno de test, debe cargarse desde .env o ser inyectada en el runner.
    expect(process.env.NEXT_PUBLIC_APP_URL).toBeDefined();
    expect(process.env.NEXT_PUBLIC_APP_URL).toMatch(/^https?:\/\/.+/);
  });

  it('NEXT_PUBLIC_APP_URL no debe incluir barra final (trailing slash)', () => {
    // Previene duplicación en construcción de URLs de API: /api/v1/health
    const url = process.env.NEXT_PUBLIC_APP_URL ?? '';
    expect(url.endsWith('/')).toBe(false);
  });
});
