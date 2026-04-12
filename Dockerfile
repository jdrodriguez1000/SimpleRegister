# =============================================================================
# Dockerfile — SimpleRegister (Multistage Build)
# Arquitectura: Next.js 15 Standalone | alpine
# Cuota RAM: 512MB (enforced en docker-compose.yml)
# Regla: Higiene Docker — solo alpine, 3 etapas, sin secretos en capas
# =============================================================================

# ---- Stage 1: deps ----
# Instala TODAS las dependencias (incluyendo devDependencies para el build)
FROM node:20-alpine AS deps
WORKDIR /app

# Instalar dependencias del sistema necesarias para compilaciones nativas
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile


# ---- Stage 2: builder ----
# Compila la aplicación Next.js en modo standalone
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Deshabilitar telemetría de Next.js en CI/builds
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build


# ---- Stage 3: runner ----
# Imagen final de producción — solo artefactos necesarios
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Usuario no-root para seguridad (Principio de Mínimo Privilegio)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar artefactos standalone generados por Next.js
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Healthcheck interno del contenedor
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/v1/health > /dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
