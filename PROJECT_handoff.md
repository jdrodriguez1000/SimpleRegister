# 🤝 Project Handoff — Bloques 4 y 5: Dashboard de Salud (Estructura + UI Logic)

**Estado Actual:** Bloques 4 y 5 certificados. La capa frontend tiene arquitectura de tipos contractuales, Tailwind v4, máquina de estados pura, 5 componentes atómicos y 144 tests GREEN.
**Fecha de Corte:** 2026-04-13
**Próxima Sesión Objetivo:** Bloque 6 — Capa de Integración & Resiliencia FE (TSK-I1-F03-R onwards).

---

## §1 Coordenadas de Ejecución

| Campo | Valor |
|---|---|
| **Iteración** | Iteración 1 — Cimientos y Performance Base |
| **Bloques Completados** | B4 (FE Estructura, Etapa 1.4.0) + B5 (UI Logic & States, Etapa 1.5.0) |
| **Bloque Siguiente** | Bloque 6 — Capa de Integración & Resiliencia FE (Etapa 1.6.0) |
| **Rama activa** | `feat/i1_b4_fe_structure` |
| **Agentes que actuaron** | `frontend-tester`, `frontend-coder`, `frontend-reviewer` |
| **Capas impactadas** | Frontend (tipos, hook, componentes, tests), tsconfig, jest config |

---

## §2 Hitos y Avance de Etapa

### Bloque 4 — Dashboard de Salud: Estructura (Etapa 1.4.0) ✅
- **TSK-I1-F01-R**: Suite RED de arquitectura (`arch_config.test.ts`, 34 tests) — trigger: `@/types/health` inexistente.
- **TSK-I1-F01-G**: Bootstrap Green — `types/health.ts` (1:1 con Spec), Tailwind CSS v4, `globals.css` con design tokens, `SkeletonDashboard` estático en `page.tsx`.
- **TSK-I1-F01-RF**: Refactor — layout limpio, clase `.sr-only`, `jest.setup.ts` para `NEXT_PUBLIC_APP_URL`.
- **TSK-I1-F01-V**: 34/34 tests GREEN. `tsc --noEmit` limpio. Env vars verificadas.
- **TSK-I1-F01-C**: Certificado con corrección: `<p>` → `<h1 className="sr-only">` (jerarquía WCAG).

### Bloque 5 — UI Logic & States (Etapa 1.5.0) ✅
- **TSK-I1-F02-R**: Suite RED de máquina de estados (`ui_states.test.ts`, 46 tests) — trigger: `@/src/hooks/useHealth` inexistente.
- **TSK-I1-F02-G**: Dashboard Green — `useHealth.ts` (funciones puras + hook), `ServiceCard`, `PerformanceMetrics`, `ErrorBanner`, `SkeletonDashboard` (extraído), `HealthDashboard` (Client Component `'use client'`). `page.tsx` → Server Component puro.
- **TSK-I1-F02-RF**: Extracción de `SkeletonDashboard` como componente de propósito único.
- **TSK-I1-F02-V**: 64 tests de estados visuales GREEN. Pipeline latencia → SLA → color CSS validado.
- **TSK-I1-F02-C**: Certificado 38/38 controles. Deuda técnica documentada.

**Progreso total de tests frontend: 144/144 GREEN.**

---

## §3 Inventario Técnico de Cambios

### Archivos Creados
| Archivo | Propósito |
|---------|-----------|
| `types/health.ts` | Contratos de tipos FE: `HealthCheckResponse`, `ConnectionStatus`, `ConfigStatus`, `ServiceName`, `HealthUIState`, `SLALevel` |
| `src/hooks/useHealth.ts` | Hook + funciones puras: `computeSLALevel`, `getInitialState`, `applyHealthResponse` + `useHealth()` |
| `src/app/globals.css` | Tailwind v4 + design tokens (`--color-sla-*`, `--color-bg-*`) + `.skeleton`, `.sr-only`, `.status-dot-*` |
| `src/app/components/ServiceCard.tsx` | Indicador atómico de un servicio (STATUS_CONFIG tabla) |
| `src/app/components/PerformanceMetrics.tsx` | Latencia + SLA badge (SLA_COLOR tabla) |
| `src/app/components/ErrorBanner.tsx` | Banner error_code + botón "Reintentar" (`role="alert"`, `aria-live="assertive"`) |
| `src/app/components/SkeletonDashboard.tsx` | Estado loading/idle — 4 skeleton cards |
| `src/app/components/HealthDashboard.tsx` | Client Component de composición — orquesta los 4 estados UI |
| `postcss.config.mjs` | PostCSS con `@tailwindcss/postcss` |
| `jest.setup.ts` | Carga `NEXT_PUBLIC_APP_URL` para runner de tests |
| `src/__tests__/frontend/arch_config.test.ts` | 34 tests arquitectura y tipos |
| `src/__tests__/frontend/ui_states.test.ts` | 46 tests máquina de estados pura |
| `src/__tests__/frontend/visual_states.test.ts` | 64 tests contratos visuales y pipeline de color |

### Archivos Modificados
| Archivo | Cambio |
|---------|--------|
| `src/app/layout.tsx` | Metadata SEO, Viewport, import `globals.css` |
| `src/app/page.tsx` | Server Component que delega a `<HealthDashboard />` |
| `tsconfig.json` | `target`: `ES2017` → `ES2018` (habilita regex flag `s`) |
| `jest.config.ts` | Añadido `setupFiles: ['<rootDir>/jest.setup.ts']` |
| `docs/governance/PROJECT_backlog.md` | TSK-I1-F01-R/G/RF/V/C + TSK-I1-F02-R/G/RF/V/C marcadas `[x]` |

### Dependencias Instaladas
| Paquete | Versión | Motivo |
|---------|---------|--------|
| `tailwindcss` | ^4.2.2 | CSS utility framework (stack oficial) |
| `@tailwindcss/postcss` | ^4.2.2 | Integración PostCSS para Next.js 15 |
| `postcss` | ^8.5.9 | Procesador CSS requerido por Tailwind v4 |

---

## §4 Mapa Táctico de Continuidad

### 🚀 NEXT STEP — Acción Inmediata (Quirúrgica)

**Tarea:** `TSK-I1-F03-R` — Integration Layer Red-Check
**Agente:** `frontend-tester`
**Archivo a crear:** `src/__tests__/frontend/integration_layer.test.ts`

**Qué debe hacer:**
Crear una suite RED que importe desde `@/src/services/healthApi` (módulo inexistente → Cannot find module → RED). Los tests deben definir los contratos del Service Layer que consumirá la API real `/api/v1/health`:
- `fetchHealthStatus(options?: { apiKey?: string }): Promise<HealthCheckResponse>` — fetch con header `X-Health-Key` opcional.
- Lógica de reintento exponencial ante 503/429 (Backoff).
- Manejo de errores de red → debe retornar un estado `unhealthy` tipado, no lanzar excepción no capturada.

**Dependencias a verificar antes de empezar:**
- `NEXT_PUBLIC_APP_URL` apunta a `http://localhost:3000` en `.env`.
- El backend en Docker responde en `/api/v1/health` (levantar con `docker compose up -d`).

### ⚠️ Deuda Técnica (no bloquea siguiente bloque)
| Deuda | Ubicación | Resolución |
|-------|-----------|------------|
| `refetch()` retorna cleanup sin que el caller lo gestione — posible setState post-unmount | `src/hooks/useHealth.ts` | TSK-I1-F03-G: reemplazar timeout mock por `AbortController` en el fetch real |
| Sin gestión de foco al transicionar error → loading (accesibilidad teclado) | `HealthDashboard.tsx` | TSK-I1-F03-G: `useRef` en el banner + `focus()` tras retry |

### Bloqueadores Conocidos
- Ninguno que impida TSK-I1-F03-R.
- El backend (`/api/v1/health`) requiere Docker activo para TSK-I1-F03-G (integración real).

---

## §5 Registro Histórico de Decisiones (Append-only ⚠️)

### [2026-04-12] — Sesión: Bloque 2 - Health API & SOP
- **Fricción:** La validación de UUIDv4 en Node.js requiere un Regex estricto para cumplir con el contrato de la Spec; el uso de librerías externas fue evitado para mantener el minimalismo.
- **Optimización:** La centralización de la lógica de latencia en un helper permite reutilizarla en futuros endpoints de la Iteración 2 (Auth/Register).

### [2026-04-12] — Sesión: Bloque 3 - Resiliencia y Rate Limiting
- **Decisión:** Se optó por un esquema de "Fixed Window" para el rate limit por simplicidad y bajo overhead en Redis, cumpliendo con los 10 req/min de la Spec.
- **Fricción:** El fallback `SYSTEM_DEGRADED` requirió un interceptor global de errores para asegurar que el payload JSON sea consistente incluso cuando la conexión a Redis falla (evitando el crash del proceso).

### [2026-04-13] — Sesión: Bloques 4 y 5 - Frontend Bootstrap + UI Logic
- **Decisión arquitectónica:** `types/health.ts` se creó en la raíz del proyecto (accesible via `@/types/health`), separado de `src/lib/types/health_types.ts` (backend). Esta separación de capas (consumidor vs proveedor) evita acoplamiento entre el contrato de API del frontend y la implementación interna del backend.
- **Decisión de testing:** Las funciones puras `computeSLALevel`, `getInitialState`, `applyHealthResponse` se exportan directamente del módulo `useHealth.ts` para ser testeables en entorno Node (sin DOM), evitando la necesidad de `jsdom` o `@testing-library/react` en esta etapa.
- **Fricción — `import type` y ts-jest:** En modo `transpileModule`, ts-jest no falla ante imports de tipo de módulos inexistentes. Para forzar el estado RED, se requiere un import de valor (no `import type`), que sí genera "Cannot find module" en runtime.
- **Corrección de tsconfig:** El target `ES2017` bloqueaba el flag `s` (dotAll) de regex, necesario para validar bloques CSS multi-línea en los tests. Actualizado a `ES2018` — compatible con Next.js 15 y entornos objetivo modernos.
- **Patrón de Server/Client Boundary:** `page.tsx` es Server Component puro (solo renderiza `<HealthDashboard />`). `HealthDashboard.tsx` tiene `'use client'` y orquesta el estado. Los componentes atómicos (ServiceCard, etc.) no requieren `'use client'` porque no usan hooks — son funciones puras de presentación.
