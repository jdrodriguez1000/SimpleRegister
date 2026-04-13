/**
 * page.tsx — Página Principal: Dashboard de Salud
 * Trazabilidad: TSK-I1-F02-G / TSK-I1-F02-RF
 *
 * Server Component: no contiene lógica, delega la interactividad completa
 * a HealthDashboard (Client Component con 'use client').
 *
 * Separación Server / Client (Next.js 15 App Router):
 *   - page.tsx      → Server Component (entrada de ruta, sin estado)
 *   - HealthDashboard → Client Component (estado, hooks, interactividad)
 */

import HealthDashboard from './components/HealthDashboard';

export default function HealthDashboardPage() {
  return <HealthDashboard />;
}
