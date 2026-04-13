/**
 * layout.tsx — Root Layout del Dashboard de Salud
 * Trazabilidad: TSK-I1-F01-G / TSK-I1-F01-RF
 *
 * Responsabilidades:
 *   - Importar estilos globales (Tailwind + tokens de diseño)
 *   - Configurar metadatos SEO de la aplicación
 *   - Proveer la estructura HTML base (html, body) sin lógica de UI
 */

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SimpleRegister — Panel de Salud',
  description: 'Dashboard de monitoreo de infraestructura del sistema SimpleRegister.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
