import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Modo standalone: genera un servidor autocontenido para Docker
  // Requerido para el Multistage Build (Dockerfile Stage 3)
  output: 'standalone',

  // Límite de memoria para el proceso de Next.js (RNF8 / Arquitectura VPS)
  // El límite final se aplica a nivel de contenedor en docker-compose.yml (512MB)
  experimental: {
    // Configuraciones experimentales se añadirán en iteraciones posteriores
  },
}

export default nextConfig
