/**
 * ui_states.test.ts — TSK-I1-F02-R: UI State Machine Red-Check
 *
 * Propósito: Validar los contratos de la máquina de estados del dashboard y
 * las funciones puras de lógica de presentación definidas en PROJECT_spec.md.
 *
 * ESTADO ESPERADO: RED
 *   - Cannot find module '@/src/hooks/useHealth' — el módulo no existe aún.
 *   - Todos los tests fallan por error de resolución de módulo.
 *
 * Contratos que el agente frontend-coder (TSK-I1-F02-G) debe satisfacer:
 *   1. Hook `useHealth()` — ciclo idle → loading → success | error
 *   2. Función pura `computeSLALevel(ms)` — umbrales SLA de la Spec
 *   3. Función pura `getInitialState()` — estado inicial de la máquina
 *   4. Función pura `applyHealthResponse(response)` — transición de estado
 *
 * Trazabilidad: TSK-I1-F02-R
 * Dependencia Resuelta: TSK-I1-F01-C (arquitectura FE certificada)
 * Siguiente Tarea: TSK-I1-F02-G (frontend-coder implementa dashboard + hook)
 */

// =============================================================================
// IMPORTACIÓN CONTRACTUAL — Causa de falla en estado RED
// @/src/hooks/useHealth no existe → Cannot find module → todos los tests fallan
// =============================================================================
import {
  computeSLALevel,
  getInitialState,
  applyHealthResponse,
} from '@/src/hooks/useHealth';

import type { HealthState } from '@/src/hooks/useHealth';
import type { HealthCheckResponse, SLALevel, HealthUIState } from '@/types/health';

// =============================================================================
// BLOQUE 1 — Estado Inicial de la Máquina (spec §Manejo de Estados UI — Idle)
// =============================================================================

describe('TSK-I1-F02-R | getInitialState — Estado Idle de la Máquina', () => {
  it('debe retornar uiState "idle" como estado inicial', () => {
    const state = getInitialState();
    expect(state.uiState).toBe<HealthUIState>('idle');
  });

  it('debe retornar data null en estado inicial', () => {
    const state = getInitialState();
    expect(state.data).toBeNull();
  });

  it('debe retornar slaLevel null en estado inicial (sin latencia conocida)', () => {
    const state = getInitialState();
    expect(state.slaLevel).toBeNull();
  });

  it('debe retornar error null en estado inicial', () => {
    const state = getInitialState();
    expect(state.error).toBeNull();
  });

  it('debe retornar lastFetchedAt null en estado inicial', () => {
    const state = getInitialState();
    expect(state.lastFetchedAt).toBeNull();
  });

  it('debe ser determinista — dos llamadas retornan estados equivalentes', () => {
    const s1 = getInitialState();
    const s2 = getInitialState();
    expect(s1).toEqual(s2);
  });
});

// =============================================================================
// BLOQUE 2 — computeSLALevel: umbrales del spec §Criterios de Degradación
// =============================================================================

describe('TSK-I1-F02-R | computeSLALevel — Clasificación de Latencia SLA', () => {
  describe('SLA Green (latencia < 200ms)', () => {
    it('latencia 0ms → green', () => {
      expect(computeSLALevel(0)).toBe<SLALevel>('green');
    });

    it('latencia 45ms → green (caso nominal del spec)', () => {
      expect(computeSLALevel(45)).toBe<SLALevel>('green');
    });

    it('latencia 45.00ms (float) → green', () => {
      expect(computeSLALevel(45.00)).toBe<SLALevel>('green');
    });

    it('latencia 199.99ms → green (justo bajo el umbral)', () => {
      expect(computeSLALevel(199.99)).toBe<SLALevel>('green');
    });
  });

  describe('SLA Warning (200ms ≤ latencia < 500ms)', () => {
    it('latencia 200ms → warning (umbral inferior exacto)', () => {
      expect(computeSLALevel(200)).toBe<SLALevel>('warning');
    });

    it('latencia 200.00ms (float) → warning', () => {
      expect(computeSLALevel(200.00)).toBe<SLALevel>('warning');
    });

    it('latencia 350ms → warning', () => {
      expect(computeSLALevel(350)).toBe<SLALevel>('warning');
    });

    it('latencia 499.99ms → warning (justo bajo el umbral superior)', () => {
      expect(computeSLALevel(499.99)).toBe<SLALevel>('warning');
    });
  });

  describe('SLA Critical (latencia ≥ 500ms)', () => {
    it('latencia 500ms → critical (umbral exacto)', () => {
      expect(computeSLALevel(500)).toBe<SLALevel>('critical');
    });

    it('latencia 500.00ms (float) → critical', () => {
      expect(computeSLALevel(500.00)).toBe<SLALevel>('critical');
    });

    it('latencia 1000ms → critical', () => {
      expect(computeSLALevel(1000)).toBe<SLALevel>('critical');
    });

    it('latencia muy alta (9999ms) → critical', () => {
      expect(computeSLALevel(9999)).toBe<SLALevel>('critical');
    });
  });
});

// =============================================================================
// BLOQUE 3 — applyHealthResponse: transiciones de estado desde respuesta API
// =============================================================================

describe('TSK-I1-F02-R | applyHealthResponse — Transiciones loading → success', () => {
  const initial = (): HealthState => ({
    uiState: 'loading',
    data: null,
    slaLevel: null,
    error: null,
    lastFetchedAt: null,
  });

  describe('Respuesta 200 healthy — modo privado (con performance y dependencies)', () => {
    const privateResponse: HealthCheckResponse = {
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

    it('transición: loading → success', () => {
      const next = applyHealthResponse(initial(), privateResponse);
      expect(next.uiState).toBe<HealthUIState>('success');
    });

    it('almacena la respuesta completa en state.data', () => {
      const next = applyHealthResponse(initial(), privateResponse);
      expect(next.data).toEqual(privateResponse);
    });

    it('computa slaLevel "green" para latencia 45ms', () => {
      const next = applyHealthResponse(initial(), privateResponse);
      expect(next.slaLevel).toBe<SLALevel>('green');
    });

    it('limpia state.error al recibir respuesta exitosa', () => {
      const withError: HealthState = { ...initial(), error: 'Error previo de red' };
      const next = applyHealthResponse(withError, privateResponse);
      expect(next.error).toBeNull();
    });

    it('registra lastFetchedAt como Date al recibir respuesta', () => {
      const next = applyHealthResponse(initial(), privateResponse);
      expect(next.lastFetchedAt).toBeInstanceOf(Date);
    });
  });

  describe('Respuesta 200 healthy — modo público (sin performance, sin dependencies)', () => {
    const publicResponse: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:01:00.000Z',
    };

    it('transición: loading → success (modo público también es éxito)', () => {
      const next = applyHealthResponse(initial(), publicResponse);
      expect(next.uiState).toBe<HealthUIState>('success');
    });

    it('slaLevel es null cuando no hay datos de performance (modo público)', () => {
      const next = applyHealthResponse(initial(), publicResponse);
      expect(next.slaLevel).toBeNull();
    });

    it('almacena la respuesta pública en state.data', () => {
      const next = applyHealthResponse(initial(), publicResponse);
      expect(next.data).toEqual(publicResponse);
    });
  });

  describe('Respuesta 200 healthy — degradación SLA warning (latencia 300ms)', () => {
    const warningResponse: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      performance: {
        api_latency_ms: 300.00,
        latency_type: 'Server-side processing',
      },
      dependencies: {
        database: 'connected',
        redis: 'connected',
        email_service: 'config_valid',
        captcha_service: 'config_valid',
      },
    };

    it('transición: loading → success (estado 200 OK aunque SLA degradado)', () => {
      const next = applyHealthResponse(initial(), warningResponse);
      expect(next.uiState).toBe<HealthUIState>('success');
    });

    it('slaLevel "warning" para latencia 300ms', () => {
      const next = applyHealthResponse(initial(), warningResponse);
      expect(next.slaLevel).toBe<SLALevel>('warning');
    });
  });
});

// =============================================================================
// BLOQUE 4 — applyHealthResponse: transiciones loading → error
// =============================================================================

describe('TSK-I1-F02-R | applyHealthResponse — Transiciones loading → error', () => {
  const initial = (): HealthState => ({
    uiState: 'loading',
    data: null,
    slaLevel: null,
    error: null,
    lastFetchedAt: null,
  });

  describe('Error 503 SYSTEM_DEGRADED — servicios críticos caídos', () => {
    const degradedResponse: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: '2026-04-11T20:02:00.000Z',
      error_code: 'SYSTEM_DEGRADED',
      message: 'Servicios críticos no disponibles.',
      unhealthy_services: ['database'],
    };

    it('transición: loading → error (spec: banner persistente con error_code)', () => {
      const next = applyHealthResponse(initial(), degradedResponse);
      expect(next.uiState).toBe<HealthUIState>('error');
    });

    it('almacena la respuesta de error en state.data para mostrar error_code en UI', () => {
      const next = applyHealthResponse(initial(), degradedResponse);
      expect(next.data).toEqual(degradedResponse);
    });

    it('slaLevel es "critical" en caso de SYSTEM_DEGRADED', () => {
      const next = applyHealthResponse(initial(), degradedResponse);
      expect(next.slaLevel).toBe<SLALevel>('critical');
    });

    it('state.error contiene el mensaje del error_code', () => {
      const next = applyHealthResponse(initial(), degradedResponse);
      expect(next.error).toBeDefined();
      expect(next.error).not.toBeNull();
    });
  });

  describe('Error 429 RATE_LIMIT_EXCEEDED — límite de peticiones superado', () => {
    const rateLimitResponse: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas peticiones. Límite de 10 req/min excedido.',
    };

    it('transición: loading → error (spec: banner con botón de reintento)', () => {
      const next = applyHealthResponse(initial(), rateLimitResponse);
      expect(next.uiState).toBe<HealthUIState>('error');
    });

    it('state.error expone el error_code RATE_LIMIT_EXCEEDED', () => {
      const next = applyHealthResponse(initial(), rateLimitResponse);
      expect(next.error).toContain('RATE_LIMIT_EXCEEDED');
    });

    it('slaLevel es "critical" ante un error de rate limit', () => {
      const next = applyHealthResponse(initial(), rateLimitResponse);
      expect(next.slaLevel).toBe<SLALevel>('critical');
    });
  });

  describe('Error 403 AUTH_REQUIRED — llave incorrecta', () => {
    const authErrorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'AUTH_REQUIRED',
      message: 'Llave de salud incorrecta o expirada.',
    };

    it('transición: loading → error', () => {
      const next = applyHealthResponse(initial(), authErrorResponse);
      expect(next.uiState).toBe<HealthUIState>('error');
    });
  });
});

// =============================================================================
// BLOQUE 5 — Contrato de la interfaz HealthState (shape requerido por el hook)
// =============================================================================

describe('TSK-I1-F02-R | HealthState — Forma del Estado del Hook', () => {
  it('HealthState debe tener la propiedad uiState de tipo HealthUIState', () => {
    const state: HealthState = getInitialState();
    expect(Object.prototype.hasOwnProperty.call(state, 'uiState')).toBe(true);
    expect(['idle', 'loading', 'success', 'error']).toContain(state.uiState);
  });

  it('HealthState debe tener la propiedad data (HealthCheckResponse | null)', () => {
    const state: HealthState = getInitialState();
    expect(Object.prototype.hasOwnProperty.call(state, 'data')).toBe(true);
  });

  it('HealthState debe tener la propiedad slaLevel (SLALevel | null)', () => {
    const state: HealthState = getInitialState();
    expect(Object.prototype.hasOwnProperty.call(state, 'slaLevel')).toBe(true);
  });

  it('HealthState debe tener la propiedad error (string | null)', () => {
    const state: HealthState = getInitialState();
    expect(Object.prototype.hasOwnProperty.call(state, 'error')).toBe(true);
    expect(typeof state.error === 'string' || state.error === null).toBe(true);
  });

  it('HealthState debe tener la propiedad lastFetchedAt (Date | null)', () => {
    const state: HealthState = getInitialState();
    expect(Object.prototype.hasOwnProperty.call(state, 'lastFetchedAt')).toBe(true);
  });
});

// =============================================================================
// BLOQUE 6 — useHealth: contrato del hook (validación de exportación)
// =============================================================================

describe('TSK-I1-F02-R | useHealth — Exportación del Hook (contrato de módulo)', () => {
  it('el módulo @/src/hooks/useHealth debe exportar computeSLALevel como función', () => {
    expect(typeof computeSLALevel).toBe('function');
  });

  it('el módulo @/src/hooks/useHealth debe exportar getInitialState como función', () => {
    expect(typeof getInitialState).toBe('function');
  });

  it('el módulo @/src/hooks/useHealth debe exportar applyHealthResponse como función', () => {
    expect(typeof applyHealthResponse).toBe('function');
  });

  it('computeSLALevel es una función pura (sin efectos secundarios)', () => {
    // Mismos inputs → mismos outputs en cualquier contexto
    expect(computeSLALevel(100)).toBe(computeSLALevel(100));
    expect(computeSLALevel(250)).toBe(computeSLALevel(250));
    expect(computeSLALevel(600)).toBe(computeSLALevel(600));
  });

  it('applyHealthResponse es una función pura (no muta el estado original)', () => {
    const original = getInitialState();
    const frozen = Object.freeze({ ...original });
    const response: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
    // No debe lanzar error al procesar un estado inmutable
    expect(() => applyHealthResponse(frozen as HealthState, response)).not.toThrow();
    // El estado original no debe haber mutado
    expect(frozen.uiState).toBe('idle');
  });
});
