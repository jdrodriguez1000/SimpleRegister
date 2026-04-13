# Reporte de Certificación — Bloque 6: Capa de Integración y Resiliencia FE (TSK-I1-F03-C)

**Agente Certificador:** `frontend-reviewer`
**Fecha de Auditoría:** 2026-04-13
**Tareas Auditadas:** `TSK-I1-F03-R` · `TSK-I1-F03-G` · `TSK-I1-F03-RF` · `TSK-I1-F03-V`
**Evidencia Base:**
- Suite Jest Bloque 6 (`integration_layer` + `integration_validation`): 202 + 58 = **260 tests PASS**
- Suite Jest Completa: **421/422 PASS** (1 RED pre-existente por diseño — Redis sin Docker)
- TypeScript: `tsc --noEmit` → **0 errores**

**Veredicto Final:** ✅ **CERTIFICADO**

---

## 1. Checklist de Cumplimiento: Service Layer (PROJECT_spec.md)

| Criterio | Fuente Spec | Valor Requerido | Implementado en | Estado |
|---|---|---|---|---|
| URL del endpoint | Spec §URL Base | `/api/v1/health` | `HEALTH_ENDPOINT = '/api/v1/health'` | ✅ PASS |
| Verbo HTTP | Spec §Definición de Endpoints | `GET` | `method: 'GET'` | ✅ PASS |
| Header `Accept` | Spec §Request Headers | `application/json` | `Accept: 'application/json'` (siempre) | ✅ PASS |
| Header `X-Health-Key` | Spec §Request Headers | UUID v4, opcional | Solo incluido si `apiKey != null` | ✅ PASS |
| Modo público (sin llave) | Spec §Lógica de Fallback Público | `200 OK` sin details | `apiKey` ausente → sin header | ✅ PASS |
| Error 400 MALFORMED_REQUEST | Spec §Errors 400 | `FetchHealthError(400)` | `fetchHealth` parsea body y lanza | ✅ PASS |
| Error 403 AUTH_REQUIRED | Spec §Errors 403 | `FetchHealthError(403)` | `fetchHealth` parsea body y lanza | ✅ PASS |
| Error 429 RATE_LIMIT_EXCEEDED | Spec §Errors 429 | `FetchHealthError(429)` + `retryAfterMs` | `Retry-After` → `ms * 1000` | ✅ PASS |
| Error 503 SYSTEM_DEGRADED | Spec §Errors 503 | `FetchHealthError(503)` con body | body completo en `.response` | ✅ PASS |
| Fallo de red | Spec implícito | `FetchHealthError(0)` | `TypeError` → `statusCode: 0` | ✅ PASS |
| `Retry-After` → `retryAfterMs` | Spec §Headers Expuestos | Delta-seconds → ms | `parseInt(header) * 1000` | ✅ PASS |

---

## 2. Checklist de Resiliencia: Reintento Automático (spec §Manejo de Estados UI)

| Escenario | Resultado Esperado (Spec) | Verificado en | Estado |
|---|---|---|---|
| 503 transitorio (1 fallo) → recupera en 2.º intento | `success` tras `retryCount: 1` | B06-V Bloque 1 | ✅ PASS |
| 503 transitorio (2 fallos) → recupera en 3.er intento | `success` tras `retryCount: 2` | B06-V Bloque 1 | ✅ PASS |
| 503 persistente (> maxRetries=3) → FetchHealthError | `error` en UI tras 4 llamadas | B06-V Bloque 1 | ✅ PASS |
| 429 con `Retry-After: 30` → espera ≥ 30s | `delay ≥ 30_000ms` | B06-V Bloque 2 | ✅ PASS |
| 429 → recupera en 2.º intento | `success` tras `retryCount: 1` | B06-V Bloque 2 | ✅ PASS |
| TypeError de red → recupera en 2.º intento | `success` tras `retryCount: 1` | B06-V Bloque 3 | ✅ PASS |
| 400 MALFORMED_REQUEST → NO reintenta | 1 sola llamada, `FetchHealthError` | B06-R Bloque 8 | ✅ PASS |
| 403 AUTH_REQUIRED → NO reintenta | 1 sola llamada, `FetchHealthError` | B06-R Bloque 8 | ✅ PASS |
| Backoff exponencial verificado (100→200→400ms) | Delays crecientes en cada reintento | B06-V Bloque 1 | ✅ PASS |

---

## 3. Checklist de Resiliencia: Máquina de Estados y Ciclo de Recuperación

| Transición | Disparador | Estado Final | Estado |
|---|---|---|---|
| `idle → loading` | Hook montado / `refetch` | `uiState: 'loading'` | ✅ PASS |
| `loading → success` | API 200 OK | `uiState: 'success'`, `error: null` | ✅ PASS |
| `loading → error` | API 503 / 429 / red | `uiState: 'error'`, `slaLevel: 'critical'` | ✅ PASS |
| `error → loading` | Usuario presiona "Reintentar" | `uiState: 'loading'` | ✅ PASS |
| `loading → success` (recuperación) | API restaurada 200 OK | `uiState: 'success'`, error limpiado | ✅ PASS |
| Estado previo no contamina recuperación | `error: null` tras recovery | Garantizado por inmutabilidad | ✅ PASS |
| SLA correcto post-recuperación | `computeSLALevel(latency)` | Green/Warning/Critical según spec | ✅ PASS |

---

## 4. Checklist de Accesibilidad y Wiring de Componentes

| Criterio | Componente | Valor | Estado |
|---|---|---|---|
| `role="alert"` (anuncio AT) | `ErrorBanner` | Presente | ✅ PASS |
| `aria-live="assertive"` (urgencia máxima) | `ErrorBanner` | Presente | ✅ PASS |
| `aria-label` descriptivo en botón retry | `ErrorBanner` | `"Reintentar conexión con la API de salud"` | ✅ PASS |
| `type="button"` (previene submit) | `ErrorBanner` | Presente | ✅ PASS |
| `onClick={onRetry}` conectado al hook | `ErrorBanner` | Presente | ✅ PASS |
| `onRetry={refetch}` (ciclo cierra) | `HealthDashboard` | Presente | ✅ PASS |
| Banner solo visible en `uiState === 'error'` | `HealthDashboard` | Rama separada de `success` | ✅ PASS |
| `errorCode` renderizado en el banner | `ErrorBanner` | `{errorCode}` — escapado por React | ✅ PASS |
| Mensaje fallback ante fallo de red | `HealthDashboard` | `'Error de conexión con la API.'` | ✅ PASS |

---

## 5. Auditoría de Calidad de Código

### 5.1 `src/lib/services/health_api_client.ts`

| Criterio | Evaluación |
|---|---|
| Responsabilidad única | ✅ Solo capa de transporte HTTP — sin lógica de UI ni de estado React |
| Separación de capas | ✅ No importa nada de React ni de `next/server` |
| Tipado estricto | ✅ Todos los tipos exportados; `FetchHealthError` extiende `Error` con `instanceof` garantizado |
| Funciones puras exportadas | ✅ `shouldRetry` y `buildExponentialDelay` son deterministas y testeables en aislamiento |
| Gestión de `Retry-After` | ✅ Extraído del header, convertido a ms, propagado en `FetchHealthError.retryAfterMs` |
| JSON parsing defensivo | ✅ `try/catch` en `response.json()` — falla gracefully con `FetchHealthError` genérico |
| AbortSignal propagado | ✅ `signal` pasado al `fetch()` nativo — cancelación completa |
| Nomenclatura | ✅ `health_api_client.ts` (snake_case), `FetchHealthError` (PascalCase), `fetchHealth` (camelCase) |
| Trazabilidad | ✅ Header de trazabilidad con referencia a spec, bloque y tareas |

### 5.2 `src/hooks/useHealth.ts` (post-refactor TSK-I1-F03-RF)

| Criterio | Evaluación |
|---|---|
| Mock eliminado | ✅ `buildMockResponse` y `setTimeout` de simulación eliminados |
| Integración con service layer | ✅ Importa `fetchHealthWithRetry` y `FetchHealthError` desde `health_api_client` |
| Cleanup de efecto | ✅ `AbortController.abort()` retornado como cleanup de `useEffect` |
| Manejo de `AbortError` | ✅ Cancelaciones intencionales silenciadas — sin actualizaciones de estado en componentes desmontados |
| Tres ramas de error | ✅ API con body SOP → `applyHealthResponse`; `AbortError` → ignorado; red pura → `SYSTEM_DEGRADED` |
| Inmutabilidad del estado | ✅ `applyHealthResponse` usa spread — no muta estado previo |
| Política de retry configurable | ✅ `HEALTH_RETRY_CONFIG` como constante del módulo — 3 reintentos, 1s base |
| Contrato de exports | ✅ Funciones puras y tipos del Bloque 5 preservados sin cambios |

---

## 6. Verificación de Contratos de la Spec (§Frontend Consumer)

| Campo | Spec | Implementación | Estado |
|---|---|---|---|
| `uiState: 'idle'` | "Initializing System..." | `getInitialState().uiState === 'idle'` | ✅ |
| `uiState: 'loading'` | Skeleton Loaders | Transición correcta antes de fetch | ✅ |
| `uiState: 'error'` | Banner persistente + retry | `FetchHealthError` → `applyHealthResponse` → error | ✅ |
| `uiState: 'success'` | Dashboard con indicadores | Respuesta `healthy` → `applyHealthResponse` → success | ✅ |
| Backoff exponencial | "botón de reintento con backoff exponencial" | `buildExponentialDelay(attempt, baseMs)` = `baseMs × 2^attempt` | ✅ |
| Reintento ante 503 | "reintenta automáticamente en caso de 503/429" | `shouldRetry(503) === true` | ✅ |
| Reintento ante 429 | "reintenta automáticamente en caso de 503/429" | `shouldRetry(429) === true` | ✅ |
| SLA Green < 200ms | Spec §Criterios de Degradación | `computeSLALevel(ms < 200) === 'green'` | ✅ |
| SLA Warning 200-500ms | Spec §Criterios de Degradación | `computeSLALevel(200 ≤ ms < 500) === 'warning'` | ✅ |
| SLA Critical ≥ 500ms | Spec §Criterios de Degradación | `computeSLALevel(ms ≥ 500) === 'critical'` | ✅ |
| Error con `error_code` en banner | "banner persistente con el `error_code`" | `state.error === response.error_code` | ✅ |
| SLA degradado en modo error | "slaLevel: critical" | `applyHealthResponse(unhealthy) → slaLevel: 'critical'` | ✅ |

---

## 7. Hallazgos del Revisor

### NOTA-B06-01 — Múltiples clicks en "Reintentar" generan requests concurrentes
**Hallazgo:** Cuando el usuario hace clic en "Reintentar" varias veces antes de que la primera petición resuelva, se generan múltiples `fetchHealthWithRetry` en vuelo simultáneamente. El último en resolver gana el race condition de `setState`.
**Impacto:** UX mínimo — el estado final siempre es coherente (éxito o error). No hay pérdida de datos ni crash.
**Contexto:** La cancelación vía `AbortController` solo aplica al montaje inicial (via `useEffect`). Los `refetch` manuales no tienen cancelación mutua.
**Decisión:** ⚠️ NO BLOQUEANTE — aceptable en Iteración 1. Solución recomendada para Iteración 2: añadir un guard `isLoading` que deshabilite el botón durante el fetch activo.

### NOTA-B06-02 — Sin jitter en el backoff exponencial
**Hallazgo:** `buildExponentialDelay` usa `baseMs × 2^attempt` sin randomización (jitter).
**Impacto:** En escenarios con múltiples clientes retrying simultáneamente (thundering herd), todos reintentan al mismo tiempo. Impacto nulo en Iteración 1 (un solo cliente por pestaña).
**Decisión:** ⚠️ NO BLOQUEANTE — deuda técnica identificada para Iteración 3 (cuando haya mayor carga).

### NOTA-B06-03 — Test RED persistente heredado en `redis_resilience.test.ts`
**Hallazgo:** `1 failed` en la suite completa corresponde a `redis_resilience.test.ts` — test que requiere Redis activo.
**Contexto:** Pre-existente desde TSK-I1-B03-R. Documentado en `cert_resilience_B03.md` §NOTA-B03-03. No relacionado con el Bloque 6.
**Decisión:** ✅ ACEPTADO — contrato con Redis real verificado en TSK-I1-B03-V con Docker.

---

## 8. Hallazgos Corregidos Durante la Auditoría

| Defecto | Archivo | Corrección Aplicada |
|---|---|---|
| `tsc` error: propiedad `retryAfterMs` no encontrada en unión `HealthCheckResponse \| FetchHealthError` | `integration_validation.test.ts` líneas 518/526/539 | Cambiado a cast explícito `(await fetchHealth().catch((e: unknown) => e)) as FetchHealthError` |

---

## 9. Matriz de Trazabilidad — Bloque 6

| Tarea | Agente | Artefacto | Tests | Estado |
|---|---|---|---|---|
| TSK-I1-F03-R | `frontend-tester` | `src/__tests__/frontend/integration_layer.test.ts` | RED confirmado (módulo inexistente) | ✅ Completada |
| TSK-I1-F03-G | `frontend-coder` | `src/lib/services/health_api_client.ts` | 160 tests GREEN | ✅ Completada |
| TSK-I1-F03-RF | `frontend-coder` | `src/hooks/useHealth.ts` (mock → real API) | Suite completa GREEN | ✅ Completada |
| TSK-I1-F03-V | `frontend-tester` | `src/__tests__/frontend/integration_validation.test.ts` | 58 tests E2E GREEN | ✅ Completada |
| TSK-I1-F03-C | `frontend-reviewer` | Este documento | TypeScript 0 errores, 421/422 GREEN | ✅ **CERTIFICADO** |

---

## 10. Firma de Certificación

```
╔══════════════════════════════════════════════════════════════╗
║  BLOQUE 6 — CAPA DE INTEGRACIÓN Y RESILIENCIA FE             ║
║  ESTADO: ✅ CERTIFICADO                                       ║
║                                                              ║
║  Criterios DoD cumplidos:                                    ║
║  ✓ Dashboard consume /api/v1/health real (mock eliminado)    ║
║  ✓ Reintento automático ante 503/429 con backoff exponencial ║
║  ✓ Retry-After header respetado en espera entre reintentos   ║
║  ✓ FetchHealthError mapea códigos HTTP a acciones UI         ║
║  ✓ Lógica de reintento centralizada en health_api_client     ║
║  ✓ AbortController — cleanup limpio en desmontaje            ║
║  ✓ ErrorBanner: role="alert" + aria-live + onRetry={refetch} ║
║  ✓ Ciclo completo verificado: error → retry → success        ║
║  ✓ TypeScript limpio (0 errores, strict: true)               ║
║  ✓ 421/422 tests PASS (1 RED pre-existente esperado)         ║
║                                                              ║
║  Agente: frontend-reviewer                                   ║
║  Fecha: 2026-04-13                                           ║
╚══════════════════════════════════════════════════════════════╝
```

*Trazabilidad: TSK-I1-F03-C — PROJECT_spec.md [Iteración 1 — Bloque 6]*
