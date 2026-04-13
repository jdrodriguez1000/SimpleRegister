/**
 * PerformanceMetrics.tsx — Componente Atómico: Métricas de Latencia y SLA
 * Trazabilidad: TSK-I1-F02-G / TSK-I1-F02-RF
 *
 * Responsabilidad única: visualizar api_latency_ms y el nivel SLA correspondiente.
 * Sin lógica de cálculo — recibe el slaLevel ya computado por computeSLALevel().
 */

import type { SLALevel } from '@/types/health';

export type PerformanceMetricsProps = {
  latencyMs: number;
  slaLevel: SLALevel;
  latencyType: string;
};

const SLA_COLOR: Record<SLALevel, string> = {
  green:    'var(--color-sla-green)',
  warning:  'var(--color-sla-warning)',
  critical: 'var(--color-sla-critical)',
};

const SLA_LABEL: Record<SLALevel, string> = {
  green:    'SLA ✓ Green',
  warning:  'SLA ⚠ Warning',
  critical: 'SLA ✗ Critical',
};

export default function PerformanceMetrics({
  latencyMs,
  slaLevel,
  latencyType,
}: PerformanceMetricsProps) {
  const color = SLA_COLOR[slaLevel];

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
        marginBottom: '1.5rem',
      }}
      role="region"
      aria-label="Métricas de rendimiento de la API"
    >
      {/* Latencia */}
      <div>
        <p
          style={{
            margin: '0 0 0.375rem',
            fontSize: '0.7rem',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.08em',
          }}
        >
          Latencia API
        </p>
        <p
          style={{ margin: 0, fontSize: '1.875rem', fontWeight: 700, color, lineHeight: 1 }}
          aria-label={`Latencia: ${latencyMs.toFixed(2)} milisegundos`}
        >
          {latencyMs.toFixed(2)}
          <span style={{ fontSize: '1rem', fontWeight: 400, marginLeft: '0.25rem' }}>ms</span>
        </p>
      </div>

      {/* Divisor */}
      <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '2rem' }}>
        <p
          style={{
            margin: '0 0 0.375rem',
            fontSize: '0.7rem',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.08em',
          }}
        >
          Estado SLA
        </p>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 600, color }}>
          {SLA_LABEL[slaLevel]}
        </p>
        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
          {latencyType}
        </p>
      </div>
    </div>
  );
}
