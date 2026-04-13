/**
 * SkeletonDashboard.tsx — Componente Atómico: Estado de Carga del Dashboard
 * Trazabilidad: TSK-I1-F02-RF — Extracción del estado loading/idle
 *
 * Responsabilidad única: renderizar los skeleton loaders del dashboard.
 * Extraído de HealthDashboard.tsx para mantener un solo propósito por componente.
 * spec §Manejo de Estados UI — Loading: skeleton loaders para los 4 servicios de dependencia.
 */

const SERVICES = ['database', 'redis', 'email_service', 'captcha_service'] as const;

export default function SkeletonDashboard() {
  return (
    <main style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 className="sr-only">SimpleRegister — Panel de Salud (Inicializando...)</h1>

      {/* Encabezado */}
      <header style={{ marginBottom: '2rem' }}>
        <div
          className="skeleton"
          style={{ height: '1.75rem', width: '16rem', marginBottom: '0.5rem' }}
          aria-hidden="true"
        />
        <div className="skeleton" style={{ height: '1rem', width: '10rem' }} aria-hidden="true" />
      </header>

      {/* Métricas de rendimiento */}
      <div
        className="skeleton-card"
        style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}
        aria-hidden="true"
      >
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: '0.75rem', width: '6rem', marginBottom: '0.75rem' }} />
          <div className="skeleton" style={{ height: '2rem', width: '8rem' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: '0.75rem', width: '5rem', marginBottom: '0.75rem' }} />
          <div className="skeleton" style={{ height: '2rem', width: '4rem' }} />
        </div>
      </div>

      {/* Indicadores de dependencias */}
      <section aria-label="Estado de dependencias">
        <div
          className="skeleton"
          style={{ height: '0.875rem', width: '8rem', marginBottom: '1rem' }}
          aria-hidden="true"
        />
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
              <div
                className="skeleton-card"
                role="status"
                aria-label={`Cargando estado de ${service}`}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="status-dot status-dot--muted" aria-hidden="true" />
                  <div
                    className="skeleton"
                    style={{ height: '0.875rem', width: '7rem' }}
                    aria-hidden="true"
                  />
                </div>
                <div
                  className="skeleton"
                  style={{ height: '1.25rem', width: '5rem' }}
                  aria-hidden="true"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
