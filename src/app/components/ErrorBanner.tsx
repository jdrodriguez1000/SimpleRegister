/**
 * ErrorBanner.tsx — Componente Atómico: Banner de Error con Reintento
 * Trazabilidad: TSK-I1-F02-G / TSK-I1-F02-RF
 *
 * Responsabilidad única: mostrar el error_code y proveer el botón de reintento.
 * spec §Manejo de Estados UI — Error: "banner persistente con error_code y botón de reintento".
 * Sin lógica de backoff — la lógica de reintento exponencial se implementa en TSK-I1-F03-G.
 */

export type ErrorBannerProps = {
  errorCode: string;
  message?: string;
  onRetry: () => void;
};

export default function ErrorBanner({ errorCode, message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid var(--color-sla-critical)',
        borderRadius: 'var(--radius-card)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <div>
        <p
          style={{
            margin: '0 0 0.25rem',
            fontSize: '0.75rem',
            color: 'var(--color-sla-critical)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
          }}
        >
          {errorCode}
        </p>
        {message != null && (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            {message}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onRetry}
        style={{
          backgroundColor: 'transparent',
          border: '1px solid var(--color-sla-critical)',
          borderRadius: '0.375rem',
          color: 'var(--color-sla-critical)',
          padding: '0.5rem 1rem',
          fontSize: '0.8rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap' as const,
          fontFamily: 'inherit',
        }}
        aria-label="Reintentar conexión con la API de salud"
      >
        Reintentar
      </button>
    </div>
  );
}
