import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SimpleRegister',
  description: 'Sistema de Registro con Validación de Mayoría de Edad',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
