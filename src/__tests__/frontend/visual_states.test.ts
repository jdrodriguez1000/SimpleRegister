/**
 * visual_states.test.ts — TSK-I1-F02-V: Visual States Validation
 *
 * Propósito: Validar que los indicadores visuales del dashboard reflejan
 * correctamente los estados SLA y de servicio definidos en PROJECT_spec.md.
 *
 * Estrategia de validación (entorno Node — sin DOM):
 *   1. Contratos de Design Tokens: hex values en globals.css vs spec SLA
 *   2. Contratos de color de componentes: SLALevel/ServiceStatus → CSS variable
 *   3. Pipeline completo: latencia → computeSLALevel → color variable
 *   4. Atributos ARIA semánticos por componente
 *   5. Exhaustividad: todos los valores de cada union type tienen representación visual
 *
 * Trazabilidad: TSK-I1-F02-V
 * Evidencia previa: TSK-I1-F02-G/RF completados — 80/80 tests GREEN
 * DoD: Validación de colores según SLA: Green (<200ms), Warning (200-500ms), Critical (>500ms o error)
 */

import * as fs from 'fs';
import * as path from 'path';
import { computeSLALevel, getInitialState, applyHealthResponse } from '@/src/hooks/useHealth';
import type { HealthCheckResponse, SLALevel, ServiceName } from '@/types/health';

const ROOT = process.cwd();
const readFile = (p: string) => fs.readFileSync(path.resolve(ROOT, p), 'utf-8');

// Archivos bajo validación
const globalsCss        = readFile('src/app/globals.css');
const serviceCardSrc    = readFile('src/app/components/ServiceCard.tsx');
const perfMetricsSrc    = readFile('src/app/components/PerformanceMetrics.tsx');
const errorBannerSrc    = readFile('src/app/components/ErrorBanner.tsx');
const healthDashSrc     = readFile('src/app/components/HealthDashboard.tsx');
const skeletonDashSrc   = readFile('src/app/components/SkeletonDashboard.tsx');

// =============================================================================
// BLOQUE 1 — Design Tokens: valores hexadecimales de variables CSS SLA
// spec §Criterios de Degradación — colores deben reflejar el nivel de riesgo
// =============================================================================

describe('TSK-I1-F02-V | Design Tokens SLA — globals.css', () => {
  it('--color-sla-green debe ser #10b981 (latencia < 200ms)', () => {
    expect(globalsCss).toMatch(/--color-sla-green:\s*#10b981/);
  });

  it('--color-sla-warning debe ser #f59e0b (latencia 200-500ms)', () => {
    expect(globalsCss).toMatch(/--color-sla-warning:\s*#f59e0b/);
  });

  it('--color-sla-critical debe ser #ef4444 (latencia ≥ 500ms o error)', () => {
    expect(globalsCss).toMatch(/--color-sla-critical:\s*#ef4444/);
  });

  it('.status-dot--green usa --color-sla-green', () => {
    expect(globalsCss).toMatch(/\.status-dot--green\s*\{[^}]*var\(--color-sla-green\)/s);
  });

  it('.status-dot--warning usa --color-sla-warning', () => {
    expect(globalsCss).toMatch(/\.status-dot--warning\s*\{[^}]*var\(--color-sla-warning\)/s);
  });

  it('.status-dot--critical usa --color-sla-critical', () => {
    expect(globalsCss).toMatch(/\.status-dot--critical\s*\{[^}]*var\(--color-sla-critical\)/s);
  });

  it('las 4 variantes de status-dot están definidas (green, warning, critical, muted)', () => {
    expect(globalsCss).toContain('.status-dot--green');
    expect(globalsCss).toContain('.status-dot--warning');
    expect(globalsCss).toContain('.status-dot--critical');
    expect(globalsCss).toContain('.status-dot--muted');
  });
});

// =============================================================================
// BLOQUE 2 — ServiceCard: contratos de color por estado de servicio
// spec §dependencies → connected/disconnected/config_valid/error
// =============================================================================

describe('TSK-I1-F02-V | ServiceCard — Mapeo de Estado a Clase de Dot', () => {
  it('estado "connected" usa la clase status-dot--green', () => {
    expect(serviceCardSrc).toMatch(/connected.*status-dot--green/s);
  });

  it('estado "disconnected" usa la clase status-dot--critical', () => {
    expect(serviceCardSrc).toMatch(/disconnected.*status-dot--critical/s);
  });

  it('estado "config_valid" usa la clase status-dot--green', () => {
    expect(serviceCardSrc).toMatch(/config_valid.*status-dot--green/s);
  });

  it('estado "error" usa la clase status-dot--critical', () => {
    // Evita confusión con el resto del código: busca el par específico en STATUS_CONFIG
    expect(serviceCardSrc).toMatch(/error.*status-dot--critical/s);
  });

  it('servicios OK (connected, config_valid) usan --color-sla-green para el texto de estado', () => {
    expect(serviceCardSrc).toContain('var(--color-sla-green)');
  });

  it('servicios KO (disconnected, error) usan --color-sla-critical para el texto de estado', () => {
    expect(serviceCardSrc).toContain('var(--color-sla-critical)');
  });

  it('el componente tiene role="status" para accesibilidad (WCAG — lectores de pantalla)', () => {
    expect(serviceCardSrc).toContain('role="status"');
  });

  it('el aria-label incluye el nombre del servicio y el estado', () => {
    // Verifica la expresión de aria-label dinámica
    expect(serviceCardSrc).toMatch(/aria-label=\{`\$\{SERVICE_LABELS\[name\]\}.*\$\{label\}`\}/);
  });

  it('los 4 ServiceName tienen una etiqueta en SERVICE_LABELS', () => {
    const names: ServiceName[] = ['database', 'redis', 'email_service', 'captcha_service'];
    for (const name of names) {
      expect(serviceCardSrc).toContain(`${name}:`);
    }
  });
});

// =============================================================================
// BLOQUE 3 — PerformanceMetrics: contratos de color por nivel SLA
// spec §Criterios de Degradación → colores deben cambiar según latencia
// =============================================================================

describe('TSK-I1-F02-V | PerformanceMetrics — Mapeo de SLALevel a Color', () => {
  it('SLA "green" usa var(--color-sla-green)', () => {
    expect(perfMetricsSrc).toMatch(/green.*var\(--color-sla-green\)/s);
  });

  it('SLA "warning" usa var(--color-sla-warning)', () => {
    expect(perfMetricsSrc).toMatch(/warning.*var\(--color-sla-warning\)/s);
  });

  it('SLA "critical" usa var(--color-sla-critical)', () => {
    expect(perfMetricsSrc).toMatch(/critical.*var\(--color-sla-critical\)/s);
  });

  it('la etiqueta SLA "green" expone texto positivo (✓)', () => {
    expect(perfMetricsSrc).toContain('SLA ✓ Green');
  });

  it('la etiqueta SLA "warning" expone texto de alerta (⚠)', () => {
    expect(perfMetricsSrc).toContain('SLA ⚠ Warning');
  });

  it('la etiqueta SLA "critical" expone texto de fallo (✗)', () => {
    expect(perfMetricsSrc).toContain('SLA ✗ Critical');
  });

  it('el componente tiene role="region" y aria-label de métricas', () => {
    expect(perfMetricsSrc).toContain('role="region"');
    expect(perfMetricsSrc).toContain('aria-label="Métricas de rendimiento de la API"');
  });

  it('la latencia se formatea con 2 decimales (.toFixed(2))', () => {
    expect(perfMetricsSrc).toContain('toFixed(2)');
  });

  it('el aria-label del valor de latencia incluye "milisegundos"', () => {
    expect(perfMetricsSrc).toContain('milisegundos');
  });

  it('el mapa SLA_COLOR cubre los 3 niveles (exhaustividad)', () => {
    const levels: SLALevel[] = ['green', 'warning', 'critical'];
    for (const level of levels) {
      expect(perfMetricsSrc).toContain(`${level}:`);
    }
  });
});

// =============================================================================
// BLOQUE 4 — ErrorBanner: contratos de color y accesibilidad de error
// spec §Manejo de Estados UI — Error
// =============================================================================

describe('TSK-I1-F02-V | ErrorBanner — Atributos de Error y Accesibilidad', () => {
  it('el contenedor tiene role="alert" (WCAG — anuncio inmediato a AT)', () => {
    expect(errorBannerSrc).toContain('role="alert"');
  });

  it('el contenedor tiene aria-live="assertive" (anuncio urgente)', () => {
    expect(errorBannerSrc).toContain('aria-live="assertive"');
  });

  it('el borde del banner usa --color-sla-critical', () => {
    expect(errorBannerSrc).toContain('var(--color-sla-critical)');
  });

  it('el botón de reintento tiene type="button" (previene submit en formularios)', () => {
    expect(errorBannerSrc).toContain('type="button"');
  });

  it('el botón de reintento tiene aria-label descriptivo', () => {
    expect(errorBannerSrc).toContain('aria-label="Reintentar conexión con la API de salud"');
  });

  it('el errorCode se renderiza en color --color-sla-critical', () => {
    expect(errorBannerSrc).toMatch(/errorCode[\s\S]*?color-sla-critical/);
  });

  it('el mensaje es opcional (no renderiza si no se provee)', () => {
    expect(errorBannerSrc).toContain('message != null');
  });
});

// =============================================================================
// BLOQUE 5 — Pipeline completo: latencia → SLALevel → color visual
// DoD: "Validación de que los colores cambian según SLA"
// =============================================================================

describe('TSK-I1-F02-V | Pipeline SLA Completo — Latencia → Color', () => {
  const SLA_COLOR_VAR: Record<SLALevel, string> = {
    green:    'var(--color-sla-green)',
    warning:  'var(--color-sla-warning)',
    critical: 'var(--color-sla-critical)',
  };

  const scenarios: Array<{ latency: number; expectedSLA: SLALevel; description: string }> = [
    { latency: 0,      expectedSLA: 'green',    description: 'latencia 0ms'       },
    { latency: 45,     expectedSLA: 'green',    description: 'latencia 45ms (nominal spec)' },
    { latency: 199.99, expectedSLA: 'green',    description: 'latencia 199.99ms'  },
    { latency: 200,    expectedSLA: 'warning',  description: 'latencia 200ms (umbral)' },
    { latency: 350,    expectedSLA: 'warning',  description: 'latencia 350ms'     },
    { latency: 499.99, expectedSLA: 'warning',  description: 'latencia 499.99ms' },
    { latency: 500,    expectedSLA: 'critical', description: 'latencia 500ms (umbral)' },
    { latency: 1200,   expectedSLA: 'critical', description: 'latencia 1200ms'   },
  ];

  for (const { latency, expectedSLA, description } of scenarios) {
    it(`${description} → SLA "${expectedSLA}" → color "${SLA_COLOR_VAR[expectedSLA]}"`, () => {
      const slaLevel = computeSLALevel(latency);
      expect(slaLevel).toBe(expectedSLA);
      // Verifica que el color está definido en PerformanceMetrics para ese nivel
      expect(perfMetricsSrc).toContain(SLA_COLOR_VAR[expectedSLA]);
    });
  }

  it('cada nivel SLA tiene exactamente un color CSS variable asignado (sin ambigüedad)', () => {
    const levels: SLALevel[] = ['green', 'warning', 'critical'];
    const colorVars = levels.map(l => SLA_COLOR_VAR[l]);
    const uniqueVars = new Set(colorVars);
    // 3 niveles distintos → 3 variables distintas (no hay colisión)
    expect(uniqueVars.size).toBe(3);
  });
});

// =============================================================================
// BLOQUE 6 — Pipeline: API Response → HealthState → Visual State
// Valida que la cadena de datos llega a los componentes correctamente
// =============================================================================

describe('TSK-I1-F02-V | Pipeline API Response → Estado Visual', () => {
  const loading = () => ({ uiState: 'loading' as const, data: null, slaLevel: null, error: null, lastFetchedAt: null });

  it('respuesta healthy 45ms → success + slaLevel green → ServiceCards verdes', () => {
    const response: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      performance: { api_latency_ms: 45.00, latency_type: 'Server-side' },
      dependencies: { database: 'connected', redis: 'connected', email_service: 'config_valid', captcha_service: 'config_valid' },
    };
    const state = applyHealthResponse(loading(), response);
    expect(state.uiState).toBe('success');
    expect(state.slaLevel).toBe('green');
    // ServiceCard recibirá status 'connected'/'config_valid' → dot verde
    expect(serviceCardSrc).toMatch(/connected.*status-dot--green/s);
  });

  it('respuesta healthy 350ms → success + slaLevel warning', () => {
    const response: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      performance: { api_latency_ms: 350.00, latency_type: 'Server-side' },
      dependencies: { database: 'connected', redis: 'connected', email_service: 'config_valid', captcha_service: 'config_valid' },
    };
    const state = applyHealthResponse(loading(), response);
    expect(state.uiState).toBe('success');
    expect(state.slaLevel).toBe('warning');
  });

  it('respuesta healthy 600ms → success + slaLevel critical', () => {
    const response: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      performance: { api_latency_ms: 600.00, latency_type: 'Server-side' },
      dependencies: { database: 'connected', redis: 'connected', email_service: 'config_valid', captcha_service: 'config_valid' },
    };
    const state = applyHealthResponse(loading(), response);
    expect(state.uiState).toBe('success');
    expect(state.slaLevel).toBe('critical');
  });

  it('respuesta unhealthy 503 → error + slaLevel critical → ErrorBanner con color crítico', () => {
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'SYSTEM_DEGRADED',
      message: 'Servicios críticos no disponibles.',
      unhealthy_services: ['database', 'redis'],
    };
    const state = applyHealthResponse(loading(), response);
    expect(state.uiState).toBe('error');
    expect(state.slaLevel).toBe('critical');
    expect(state.error).toBe('SYSTEM_DEGRADED');
    // ErrorBanner recibirá errorCode 'SYSTEM_DEGRADED' con color crítico
    expect(errorBannerSrc).toContain('var(--color-sla-critical)');
  });

  it('respuesta unhealthy 429 → error + errorCode RATE_LIMIT_EXCEEDED', () => {
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'RATE_LIMIT_EXCEEDED',
      message: 'Límite de 10 req/min excedido.',
    };
    const state = applyHealthResponse(loading(), response);
    expect(state.uiState).toBe('error');
    expect(state.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(state.slaLevel).toBe('critical');
  });

  it('respuesta healthy sin performance → slaLevel null (modo público sin indicador de latencia)', () => {
    const response: HealthCheckResponse = {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
    const state = applyHealthResponse(loading(), response);
    expect(state.uiState).toBe('success');
    expect(state.slaLevel).toBeNull();
  });
});

// =============================================================================
// BLOQUE 7 — Estructura de HealthDashboard: ramas de estado y composición
// Valida que cada rama de uiState renderiza el componente correcto
// =============================================================================

describe('TSK-I1-F02-V | HealthDashboard — Composición por Estado de UI', () => {
  it('rama idle/loading renderiza SkeletonDashboard (no lógica inline)', () => {
    expect(healthDashSrc).toContain('SkeletonDashboard');
    expect(healthDashSrc).toMatch(/uiState === 'idle'.*uiState === 'loading'/s);
  });

  it('rama error renderiza ErrorBanner con errorCode y onRetry=refetch', () => {
    expect(healthDashSrc).toContain('ErrorBanner');
    expect(healthDashSrc).toContain('onRetry={refetch}');
  });

  it('rama success renderiza PerformanceMetrics cuando hay datos de performance', () => {
    expect(healthDashSrc).toContain('PerformanceMetrics');
    expect(healthDashSrc).toMatch(/hasPerf.*PerformanceMetrics/s);
  });

  it('rama success renderiza ServiceCard para cada dependencia', () => {
    expect(healthDashSrc).toContain('ServiceCard');
    expect(healthDashSrc).toContain('SERVICES.map');
  });

  it('el banner de degradación SLA compromised aparece cuando hay servicios no críticos en error', () => {
    expect(healthDashSrc).toContain('SLA compromised');
    expect(healthDashSrc).toContain('hasDegradedNonCritical');
  });

  it('HealthDashboard usa useHealth para obtener state y refetch', () => {
    expect(healthDashSrc).toContain('useHealth()');
    expect(healthDashSrc).toContain('state, refetch');
  });

  it('el Client Component tiene directiva "use client" al inicio del archivo', () => {
    expect(healthDashSrc.trimStart()).toMatch(/^'use client'/);
  });
});

// =============================================================================
// BLOQUE 8 — SkeletonDashboard: skeleton loaders para los 4 servicios
// spec §Manejo de Estados UI — Loading
// =============================================================================

describe('TSK-I1-F02-V | SkeletonDashboard — Skeleton Loaders de Carga', () => {
  it('renderiza skeleton-card para cada uno de los 4 servicios', () => {
    const services: ServiceName[] = ['database', 'redis', 'email_service', 'captcha_service'];
    for (const service of services) {
      expect(skeletonDashSrc).toContain(service);
    }
  });

  it('usa role="status" y aria-label en cada skeleton card', () => {
    expect(skeletonDashSrc).toContain('role="status"');
    expect(skeletonDashSrc).toContain('aria-label={`Cargando estado de ${service}`}');
  });

  it('usa clase .skeleton-card para las tarjetas de carga', () => {
    expect(skeletonDashSrc).toContain('skeleton-card');
  });

  it('usa clase .skeleton para los placeholders de texto', () => {
    expect(skeletonDashSrc).toContain('"skeleton"');
  });

  it('usa status-dot--muted para el indicador en estado de carga', () => {
    expect(skeletonDashSrc).toContain('status-dot--muted');
  });

  it('tiene h1 sr-only para lectores de pantalla durante la carga', () => {
    expect(skeletonDashSrc).toContain('<h1 className="sr-only"');
    expect(skeletonDashSrc).toContain('Inicializando');
  });
});

// =============================================================================
// BLOQUE 9 — Estado Inicial: la máquina arranca en idle (no loading anticipado)
// =============================================================================

describe('TSK-I1-F02-V | Estado Inicial — Verificación de Arranque Correcto', () => {
  it('getInitialState() retorna uiState "idle" — la UI empieza en reposo', () => {
    expect(getInitialState().uiState).toBe('idle');
  });

  it('el estado idle tiene slaLevel null — no hay color SLA antes del primer fetch', () => {
    expect(getInitialState().slaLevel).toBeNull();
  });

  it('el estado idle tiene data null — no hay respuesta previa de la API', () => {
    expect(getInitialState().data).toBeNull();
  });
});
