'use client';

/**
 * HealthDashboard.tsx — Componente de Composición: Dashboard de Salud
 * Trazabilidad: TSK-I1-F02-G / TSK-I1-F02-RF
 *
 * Client Component: consume useHealth() (useState + useEffect).
 *
 * Responsabilidad: orquestar los estados de la máquina y componer los
 * componentes atómicos. Sin lógica de cálculo ni estilos propios de negocio.
 *
 * Separación de responsabilidades (TSK-I1-F02-RF):
 *   - Lógica de datos    → useHealth (hook)
 *   - Estado loading     → SkeletonDashboard
 *   - Indicador servicio → ServiceCard
 *   - Métricas latencia  → PerformanceMetrics
 *   - Banner de error    → ErrorBanner
 */

import { useHealth } from '@/src/hooks/useHealth';
import SkeletonDashboard from './SkeletonDashboard';
import ServiceCard from './ServiceCard';
import PerformanceMetrics from './PerformanceMetrics';
import ErrorBanner from './ErrorBanner';
import type { ServiceName } from '@/types/health';

const SERVICES: ServiceName[] = ['database', 'redis', 'email_service', 'captcha_service'];

export default function HealthDashboard() {
  const { state, refetch } = useHealth();
  const { uiState, data, slaLevel, error } = state;

  // --- Estados idle / loading: skeleton ---
  if (uiState === 'idle' || uiState === 'loading') {
    return <SkeletonDashboard />;
  }

  // --- Estado error: banner con código de error + reintento ---
  if (uiState === 'error') {
    const errorCode = error ?? 'ERROR';
    const errorMessage =
      data?.status === 'unhealthy' ? data.message : 'Error de conexión con la API.';

    return (
      <main style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1rem' }}>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', color: 'var(--color-text-primary)' }}>
          Panel de Salud
        </h1>
        <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          SimpleRegister — Estado del Sistema
        </p>
        <ErrorBanner errorCode={errorCode} message={errorMessage} onRetry={refetch} />
      </main>
    );
  }

  // --- Estado success: dashboard completo ---
  if (uiState === 'success' && data?.status === 'healthy') {
    const hasPerf = data.performance != null && slaLevel != null;
    const hasDeps = data.dependencies != null;

    // spec §Success (Partial/Degraded): banner cuando servicios no críticos están en error
    const hasDegradedNonCritical =
      hasDeps &&
      (data.dependencies!.email_service === 'error' ||
        data.dependencies!.captcha_service === 'error');

    return (
      <main style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1rem' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', color: 'var(--color-text-primary)' }}>
            Panel de Salud
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            SimpleRegister — Estado del Sistema
            <span style={{ marginLeft: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
              v{data.version} · {new Date(data.timestamp).toLocaleTimeString('es-ES')}
            </span>
          </p>
        </header>

        {/* Banner de degradación de servicios no críticos */}
        {hasDegradedNonCritical && (
          <div
            role="alert"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid var(--color-sla-warning)',
              borderRadius: 'var(--radius-card)',
              padding: '0.75rem 1.25rem',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              color: 'var(--color-sla-warning)',
            }}
          >
            ⚠ SLA compromised (Check Non-Critical Services)
          </div>
        )}

        {/* Métricas de rendimiento — solo en modo privado */}
        {hasPerf && (
          <PerformanceMetrics
            latencyMs={data.performance!.api_latency_ms}
            slaLevel={slaLevel!}
            latencyType={data.performance!.latency_type}
          />
        )}

        {/* Indicadores de dependencias — solo en modo privado */}
        {hasDeps && (
          <section aria-label="Estado de dependencias">
            <h2
              style={{
                margin: '0 0 1rem',
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
              }}
            >
              Dependencias
            </h2>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))',
                gap: '1rem',
              }}
            >
              {SERVICES.map(service => (
                <li key={service}>
                  <ServiceCard name={service} status={data.dependencies![service]} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    );
  }

  return null;
}
