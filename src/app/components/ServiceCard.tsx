/**
 * ServiceCard.tsx — Componente Atómico: Indicador de Estado de un Servicio
 * Trazabilidad: TSK-I1-F02-G / TSK-I1-F02-RF
 *
 * Responsabilidad única: renderizar el estado de UNA dependencia del sistema.
 * Sin lógica de datos — recibe props, renderiza.
 */

import type { ServiceName, ConnectionStatus, ConfigStatus } from '@/types/health';

type ServiceStatus = ConnectionStatus | ConfigStatus;

export type ServiceCardProps = {
  name: ServiceName;
  status: ServiceStatus;
};

const SERVICE_LABELS: Record<ServiceName, string> = {
  database:        'Base de Datos',
  redis:           'Redis Cache',
  email_service:   'Servicio Email',
  captcha_service: 'Captcha',
};

const STATUS_CONFIG: Record<ServiceStatus, { dotClass: string; label: string; isOk: boolean }> = {
  connected:    { dotClass: 'status-dot--green',    label: 'Conectado',    isOk: true  },
  disconnected: { dotClass: 'status-dot--critical', label: 'Desconectado', isOk: false },
  config_valid: { dotClass: 'status-dot--green',    label: 'Configurado',  isOk: true  },
  error:        { dotClass: 'status-dot--critical', label: 'Error Config', isOk: false },
};

export default function ServiceCard({ name, status }: ServiceCardProps) {
  const { dotClass, label, isOk } = STATUS_CONFIG[status];

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
      }}
      role="status"
      aria-label={`${SERVICE_LABELS[name]}: ${label}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className={`status-dot ${dotClass}`} aria-hidden="true" />
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
          }}
        >
          {SERVICE_LABELS[name]}
        </span>
      </div>
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: isOk ? 'var(--color-sla-green)' : 'var(--color-sla-critical)',
        }}
      >
        {label}
      </span>
    </div>
  );
}
