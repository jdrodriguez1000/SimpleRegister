/**
 * TSK-I1-B02-V — sop_helpers.test.ts
 * Agente: backend-tester
 * Cobertura objetivo: src/lib/helpers/sop_response.ts → 100%
 *
 * Valida que los constructores de respuesta SOP emitan exactamente
 * la forma documentada en PROJECT_spec.md. Ningun campo extra permitido.
 */

import {
  buildPublicSuccessResponse,
  buildPrivateSuccessResponse,
  buildErrorResponse,
  formatLatency,
} from '@/src/lib/helpers/sop_response';
import type { DependencyStatus } from '@/src/lib/services/health_service';

// =============================================================================
// formatLatency
// =============================================================================

describe('[B02-V] formatLatency — serializacion Float-2 obligatoria', () => {
  it('convierte un entero a float con 2 decimales implicitos', () => {
    // En produccion: 45.toFixed(2) = "45.00" → parseFloat = 45
    expect(formatLatency(45)).toBe(45);
  });

  it('redondea a 2 decimales cuando hay mas precision', () => {
    expect(formatLatency(14.527)).toBe(14.53);
  });

  it('mantiene exactamente 2 decimales para valores ya formateados', () => {
    expect(formatLatency(199.99)).toBe(199.99);
  });

  it('trata correctamente la latencia cero', () => {
    expect(formatLatency(0)).toBe(0);
  });
});

// =============================================================================
// buildPublicSuccessResponse
// =============================================================================

describe('[B02-V] buildPublicSuccessResponse — contrato 200 Publico', () => {
  it('retorna exactamente { status, version, timestamp } sin campos extra', () => {
    const res = buildPublicSuccessResponse();
    expect(Object.keys(res)).toEqual(['status', 'version', 'timestamp']);
  });

  it('status es "healthy"', () => {
    expect(buildPublicSuccessResponse().status).toBe('healthy');
  });

  it('version es "1.0.0" (constante de aplicacion)', () => {
    expect(buildPublicSuccessResponse().version).toBe('1.0.0');
  });

  it('timestamp es ISO-8601 UTC con milisegundos', () => {
    const ts = buildPublicSuccessResponse().timestamp;
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('no incluye performance ni dependencies', () => {
    const res = buildPublicSuccessResponse() as unknown as Record<string, unknown>;
    expect(res.performance).toBeUndefined();
    expect(res.dependencies).toBeUndefined();
  });
});

// =============================================================================
// buildPrivateSuccessResponse
// =============================================================================

describe('[B02-V] buildPrivateSuccessResponse — contrato 200 Privado', () => {
  const mockDeps: DependencyStatus = {
    database: 'connected',
    redis: 'connected',
    email_service: 'config_valid',
    captcha_service: 'config_valid',
  };

  it('retorna los 5 campos raiz del contrato privado', () => {
    const res = buildPrivateSuccessResponse(45.30, mockDeps);
    expect(Object.keys(res)).toEqual([
      'status',
      'version',
      'timestamp',
      'performance',
      'dependencies',
    ]);
  });

  it('status es "healthy"', () => {
    expect(buildPrivateSuccessResponse(45.30, mockDeps).status).toBe('healthy');
  });

  it('performance contiene api_latency_ms con la latencia formateada', () => {
    const res = buildPrivateSuccessResponse(14.527, mockDeps);
    expect(res.performance.api_latency_ms).toBe(14.53);
  });

  it('performance.latency_type contiene la descripcion correcta', () => {
    const res = buildPrivateSuccessResponse(45.30, mockDeps);
    expect(res.performance.latency_type).toBe(
      'Server-side processing (including DB/Redis check)'
    );
  });

  it('dependencies refleja los estados de las dependencias pasadas', () => {
    const res = buildPrivateSuccessResponse(45.30, mockDeps);
    expect(res.dependencies.database).toBe('connected');
    expect(res.dependencies.redis).toBe('connected');
    expect(res.dependencies.email_service).toBe('config_valid');
    expect(res.dependencies.captcha_service).toBe('config_valid');
  });

  it('dependencies refleja correctamente el estado degradado', () => {
    const degradedDeps: DependencyStatus = {
      ...mockDeps,
      database: 'disconnected',
      email_service: 'error',
    };
    const res = buildPrivateSuccessResponse(99.00, degradedDeps);
    expect(res.dependencies.database).toBe('disconnected');
    expect(res.dependencies.email_service).toBe('error');
  });
});

// =============================================================================
// buildErrorResponse
// =============================================================================

describe('[B02-V] buildErrorResponse — contrato de errores SOP', () => {
  it('construye un error 400 MALFORMED_REQUEST sin unhealthy_services', () => {
    const res = buildErrorResponse(
      'MALFORMED_REQUEST',
      'Formato de X-Health-Key invalido (Debe ser UUID v4).'
    );
    expect(res.status).toBe('unhealthy');
    expect(res.error_code).toBe('MALFORMED_REQUEST');
    expect(res.version).toBe('1.0.0');
    expect(res.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(res.unhealthy_services).toBeUndefined();
  });

  it('construye un error 503 SYSTEM_DEGRADED con unhealthy_services', () => {
    const res = buildErrorResponse(
      'SYSTEM_DEGRADED',
      'Servicios criticos no disponibles.',
      ['database', 'redis']
    );
    expect(res.error_code).toBe('SYSTEM_DEGRADED');
    expect(res.unhealthy_services).toEqual(['database', 'redis']);
  });

  it('no incluye unhealthy_services cuando el array esta vacio', () => {
    const res = buildErrorResponse('AUTH_REQUIRED', 'Llave incorrecta.', []);
    expect(res.unhealthy_services).toBeUndefined();
  });

  it('construye correctamente todos los error_code del catalogo', () => {
    const codes = [
      'MALFORMED_REQUEST',
      'AUTH_REQUIRED',
      'RATE_LIMIT_EXCEEDED',
      'SYSTEM_DEGRADED',
      'CONTENT_TYPE_NOT_SUPPORTED',
    ] as const;
    codes.forEach((code) => {
      const res = buildErrorResponse(code, 'test');
      expect(res.error_code).toBe(code);
    });
  });

  it('los campos raiz son exactamente los permitidos por el SOP (con unhealthy)', () => {
    const res = buildErrorResponse('SYSTEM_DEGRADED', 'test', ['database']);
    const keys = Object.keys(res);
    expect(keys).toContain('status');
    expect(keys).toContain('version');
    expect(keys).toContain('timestamp');
    expect(keys).toContain('error_code');
    expect(keys).toContain('message');
    expect(keys).toContain('unhealthy_services');
    // No campos fantasma
    expect(keys.length).toBe(6);
  });
});

// =============================================================================
// Cobertura de rama ausente: validateSopResponseShape con modo invalido
// Importada aqui para no contaminar sop_format.test.ts con un caso de tipo
// =============================================================================

import { validateSopResponseShape } from '@/src/lib/validators/health_validators';

describe('[B02-V] validateSopResponseShape — modo invalido (rama linea 173)', () => {
  it('retorna false si el modo no esta en el catalogo de modos validos', () => {
    const obj = { status: 'healthy', version: '1.0.0', timestamp: '2026-04-11T20:00:00.000Z' };
    // Se usa "as any" para simular una llamada con modo fuera del tipo en runtime
    expect(validateSopResponseShape(obj, 'unknown_mode' as never)).toBe(false);
  });
});
