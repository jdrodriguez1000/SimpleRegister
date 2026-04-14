# 🤝 Project Handoff — Iteración 2: Bloque 9 (SAFE REGISTRY) COMPLETADO · Etapa 2.2.0 ✅

**Estado Actual:** Bloque 9 — Registro de Usuario & Safe Registry (Backend) completado y certificado. Ciclo TDD completo ejecutado (RED → GREEN → REFACTOR → VAL → CERT). 639/640 tests PASS (1 fallo preexistente no bloqueante en `redis_resilience.test.ts` — ámbito B03, fuera de B09).

**Fecha de Corte:** 2026-04-14
**Rama Activa:** `feat/i2_b8_auth_schema` (pendiente push + PR con trabajo de Bloque 9)
**Próxima Sesión Objetivo:** Iniciar **Bloque 10 — Verificación & Resend Logic [Etapa 2.3.0]** con tarea `TSK-I2-B03-R` (`backend-tester`).

---

## §1 Coordenadas de Ejecución

| Campo | Valor |
|---|---|
| **Iteración** | Iteración 2 — Registro y Validación de Origen (**EN CURSO**) |
| **Bloque Actual** | Bloque 9 — Registro de Usuario & Safe Registry (Backend) (**COMPLETADO**) |
| **Etapa** | 2.2.0 — Backend Registration & Privacy Layer |
| **Rama activa** | `feat/i2_b8_auth_schema` (incluye trabajo de B09, sin push aún) |
| **Tareas B09** | 7/7 completadas `[x]` (R, G1, G2, G3, RF, V, C) |
| **Agentes que actuaron** | `backend-tester`, `backend-coder` (×4), `backend-reviewer` |
| **Capas impactadas** | Backend (services, middleware, test suites) |
| **Progreso Bloque 9** | 7/7 tareas [x] · ~121 tests nuevos (RED + VAL) todos GREEN |
| **Progreso Iteración 2** | 2/13 bloques completados (B08 + B09) ≈ 15.4% → avanzando |
| **Progreso Global** | ~47 tareas [x] de ~130 totales ≈ 36% del proyecto |

---

## §2 Hitos y Avance de Etapa — Bloque 9

### Bloque 9 — Registro de Usuario & Safe Registry (Backend) [Etapa 2.2.0] ✅ COMPLETADO

#### **TSK-I2-B02-R** — Register Contract Red ✅
- **Agente:** `backend-tester`
- **Resultado:** Suite RED creada en `src/__tests__/auth/register.test.ts`
- **Evidencia:** ~65 tests (estado RED inicial → GREEN tras implementación)
- **Cobertura de Tests:**
  - Campo email: formato RFC 5322, longitud 5-254, normalización lowercase
  - Campo password: regex de complejidad + límite 128 BYTES UTF-8 (`Buffer.byteLength`)
  - Campo birthdate: YYYY-MM-DD, mayores de 18 años, minDate 1900-01-01, leap-year aware (29-Feb)
  - Campo terms_accepted: boolean estricto (no string, no truthy)
  - Respuesta 201: user_id + token_expires_at (Now + 24h)
  - Respuesta 400 completa: INVALID_EMAIL, WEAK_PASSWORD, INVALID_AGE, TERMS_NOT_ACCEPTED, MALFORMED_REQUEST
  - Respuesta 429: REGISTRATION_LIMIT_EXCEEDED + X-RateLimit-* headers
  - Respuesta 503: SYSTEM_DEGRADED (fail-closed RNF9)
  - Anti-enumeración: colisión de email → 201 dummy (mismo código que éxito)
  - SOP compliance: `version` + `timestamp` mandatorios en TODAS las respuestas

#### **TSK-I2-B02-G1** — Register Service Core ✅
- **Agente:** `backend-coder`
- **Resultado:** Caso de uso de registro implementado
- **Archivos Creados:**
  - `src/lib/services/register_service.ts` — Función `registerUser()` con flujo completo
- **Especificidad Técnica:**
  - Clean Architecture: no importa Next.js, no importa ORM — agnóstico de framework
  - Guard clauses en `validateRequest()` — retorna primer error con semántica SOP
  - `Buffer.byteLength(password, 'utf8') > 128` — validación de bytes, no chars
  - Anti-enumeración: colisiones (email duplicado) → 201 `dummy` con UUID rotativo
  - `buildSopBase()` + `buildSopHeaders()` garantizan esquema SOP en TODA respuesta
  - `newUuid()` + `nowIso()` como utilidades atómicas nombradas

#### **TSK-I2-B02-G2** — Rate Limiter Register ✅
- **Agente:** `backend-coder`
- **Resultado:** Middleware de rate limiting específico para registro
- **Archivos Creados:**
  - `src/lib/middleware/register_rate_limiter.ts` — Factory `createRegisterRateLimiter()`
- **Especificidad Técnica:**
  - Fixed Window diario: 5 req/día/IP
  - Reset a las 00:00 UTC: `nextMidnightUtcEpoch()` para TTL dinámico
  - `X-RateLimit-Reset` en Unix Epoch (segundos), no ISO-8601
  - Fail-Closed (RNF9): Redis caído → `CACHE_UNAVAILABLE` → 503 SYSTEM_DEGRADED
  - Interfaz `RateLimiterStore` exportada para inyección de dependencias en tests

#### **TSK-I2-B02-G3** — Email Dispatch Integration ✅
- **Agente:** `backend-coder`
- **Resultado:** Integración de envío de email en flujo de registro
- **Especificidad Técnica:**
  - Degradación graciosa: fallo de email → 201 con `warning_code: EMAIL_DISPATCH_FAILED`
  - El registro NO se revierte si el email falla (la cuenta se crea igualmente)
  - `status: success` preservado en respuesta con `warning_code`

#### **TSK-I2-B02-RF** — Register Refactor ✅
- **Agente:** `backend-coder`
- **Resultado:** Refactorización y hardening del servicio
- **Especificidad Técnica:**
  - Centralización de mensajes en mapa `MESSAGES` (español)
  - Centralización de error codes en constantes (inglés snake_case)
  - Separación de `validateBirthdate()` como sub-función por SRP
  - `isCalendarDateValid(y, m, d)` — validación de días en mes (sin usar `Date`)
  - Deuda técnica menor: `24 * 60 * 60 * 1000` sin alias `ONE_DAY_MS` (DT-I2-B02-02)

#### **TSK-I2-B02-V** — Register Privacy Val ✅
- **Agente:** `backend-tester`
- **Resultado:** Suite de validación de privacidad
- **Archivo Creado:**
  - `src/__tests__/auth/register_privacy_val.test.ts` — ~56 tests de penetración (todos GREEN)
- **Cobertura de Tests:**
  - Anti-enumeración: atacante no puede distinguir email nuevo vs duplicado
  - UUID dummy rotativo: 10 llamadas sucesivas en colisión → 10 UUIDs distintos (prueba estadística)
  - `X-RateLimit-Reset`: número Unix Epoch positivo (no string ISO-8601)
  - `X-RateLimit-Remaining`: decrementa entre llamadas consecutivas (misma IP)
  - `Retry-After` en 429 como número de segundos
  - Inmutabilidad de idioma: `error_code` en inglés snake_case / `message` en español
  - Warning code `EMAIL_DISPATCH_FAILED` en degradación graciosa
  - SOP compliance de `version` y `timestamp` en TODOS los status codes (201, 400, 429, 503)

#### **TSK-I2-B02-C** — Safe Registry Cert ✅
- **Agente:** `backend-reviewer`
- **Resultado:** Certificación aprobada
- **Certificado:** `audits/governance/cert_tsk_i2_b02_c.md`
- **Veredicto:** CERTIFIED — Con Minor Observation
- **Hallazgos:**
  - 24/24 contratos de `PROJECT_spec.md` verificados
  - 0 errores bloqueantes
  - 1 MINOR: Magic number `24 * 60 * 60 * 1000` sin alias semántico → registrado como DT-I2-B02-02
  - 1 GAP documentado: ausencia de `route.ts` para el adaptador HTTP (DT-I2-B02-01)

**Tests Totales Bloque 9:** ~121 tests (RED + VAL), todos GREEN ✅

---

## §3 Inventario Técnico de Cambios (Bloque 9)

### Archivos Creados
| Archivo | Propósito | Tarea |
|---------|-----------|-------|
| `src/__tests__/auth/register.test.ts` | Suite RED: ~65 tests — contrato completo del endpoint de registro | B02-R |
| `src/__tests__/auth/register_privacy_val.test.ts` | Suite VAL: ~56 tests — privacidad, anti-enumeración, SOP | B02-V |
| `src/lib/services/register_service.ts` | Caso de uso `registerUser()` — orquestación del flujo completo | B02-G1/RF |
| `src/lib/middleware/register_rate_limiter.ts` | Factory `createRegisterRateLimiter()` — Fixed Window 5/día UTC | B02-G2 |
| `audits/governance/cert_tsk_i2_b02_c.md` | Reporte de certificación firmado por `backend-reviewer` | B02-C |

### Archivos Modificados
| Archivo | Cambio | Razón |
|---------|--------|-------|
| `docs/governance/PROJECT_backlog.md` | Tareas B02-R/G1/G2/G3/RF/V/C marcadas `[x]` | Cierre de Bloque 9 |

### Deuda Técnica Bloque 9
| ID | Descripción | Severidad | Resolución Planificada |
|----|-------------|-----------|----------------------|
| DT-I2-B02-01 | `src/app/api/v1/auth/register/route.ts` — adaptador HTTP ausente | ALTA | Bloque 9-bis o inicio de ruta de integración E2E |
| DT-I2-B02-02 | `24 * 60 * 60 * 1000` sin constante `ONE_DAY_MS` | BAJA | Al crear el route handler |

---

## §4 Mapa Táctico de Continuidad

### 🚀 NEXT STEP — Acción Inmediata (Quirúrgica)

**Tarea:** `TSK-I2-B03-R` — Auth Workflows Red (Backend)
**Agente:** `backend-tester`
**Bloque:** Bloque 10 — Verificación & Resend Logic [Etapa 2.3.0]
**Estimación:** ~2-3h (RED suite)

**Qué debe hacer:**
1. Crear suite RED en `src/__tests__/auth/verify.test.ts` con tests unitarios (estado FAILING)
2. Cubrir contratos de `POST /api/v1/auth/verify`:
   - Token en body (no Query Param — spec L385 rechaza tokens en URL)
   - Normalización de token a lowercase antes de comparar
   - Respuesta 200: cuenta activada (`status: ACTIVE`)
   - Respuesta 400: token inválido / malformado
   - Respuesta 409: cuenta ya verificada (`ALREADY_VERIFIED`)
   - Respuesta 410: token expirado (>24h)
   - Respuesta 405: rechazar GET con `Method Not Allowed`
   - Respuesta 503: `SYSTEM_DEGRADED` en rutas críticas
   - Assertion mandatoria: campos SOP (`version`, `timestamp`) en TODAS las respuestas
3. Cubrir contratos de `POST /api/v1/auth/resend`:
   - Respuesta 200 genérica (sin revelar si email existe — anti-enumeración)
   - Rate limit: 3 req/hr por clave compuesta `IP:Email`
   - Colisión: cuenta ya activa → respuesta 200 dummy (anti-enumeración)
4. Incluir test de seguridad: tokens enviados en Query Param (`?token=...`) deben ser rechazados (400/405) y NO deben aparecer en logs de acceso

**Verificación previa obligatoria:**
```powershell
cd C:\Users\USUARIO\Documents\Work\SimpleRegister
npx jest --no-coverage 2>&1 | Select-Object -Last 10   # debe reportar 639/640 PASS
npx tsc --noEmit                                        # debe reportar 0 errores TypeScript
git status                                              # verificar rama activa y cambios pendientes
```

> **⚠️ Aviso:** Ejecutar `/git-push` antes de iniciar B03-R para sincronizar el trabajo del Bloque 9 con el repositorio remoto.

### Bloqueadores Conocidos
- **Ninguno técnico** — Bloque 10 puede iniciar inmediatamente.
- **Acción previa recomendada:** Push de la rama actual para preservar el trabajo de B09 en remoto.

### Riesgos Técnicos Mitigados en B09
✅ **Anti-enumeración:** Colisiones de email → 201 dummy con UUID rotativo — atacante no distingue
✅ **Rate Limiting UTC:** Fixed Window 5/día con reset preciso a 00:00 UTC (no 24h deslizante)
✅ **Fail-Closed RNF9:** Redis caído en rate limiter → 503, no paso libre
✅ **SOP Compliance:** `version` + `timestamp` en TODA respuesta (verificado en 24/24 contratos)
✅ **Clean Architecture:** `register_service.ts` sin dependencia de Next.js ni ORM
✅ **Degradación graciosa:** Fallo de email → 201 con `warning_code` (no rollback del registro)

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
- **Corrección de tsconfig:** El target `ES2017` bloqueaba el flag `s` (dotAll) de regex, necesario para validar bloques CSS multi-línea en los tests. Actualizado a `ES2018`.
- **Patrón de Server/Client Boundary:** `page.tsx` es Server Component puro. `HealthDashboard.tsx` tiene `'use client'`. Los componentes atómicos no requieren `'use client'` porque no usan hooks.

### [2026-04-13] — Sesión: Bloque 6 - Capa de Integración & Resiliencia FE
- **Decisión arquitectónica:** `FetchHealthError` implementado como clase que extiende `Error` con `Object.setPrototypeOf(this, FetchHealthError.prototype)` en el constructor — garantiza que `instanceof` funcione correctamente cuando el código es transpilado a ES2018 CommonJS por ts-jest.
- **Decisión de módulo:** `health_api_client.ts` ubicado en `src/lib/services/` (no en `src/hooks/`) — es una capa de transporte HTTP puro, sin estado React. El hook (`useHealth`) es el único consumidor y lo usa vía importación explícita.
- **Decisión de retry:** `fetchHealthWithRetry` usa un bucle `while(true)` con `break` implícito vía `return` en éxito, en lugar de recursión. Evita stack overflow en escenarios con muchos reintentos y hace el flujo más legible.
- **Fricción — Jest 30 + fake timers + promesas rechazadas:** `await jest.runAllTimersAsync()` hace que las promesas rechazadas generadas durante la ejecución de los timers sean marcadas como "unhandled rejection" por Jest 30 antes de que el `await expect(promise).rejects` pueda capturarlas. La solución es convertir la promesa a un "settled object" antes de correr los timers.
- **Fricción — TypeScript `.catch()` return type:** `promise.catch(e => e as TargetType)` crea una unión `Promise<OriginalType | TargetType>` que impide acceder a propiedades específicas del tipo capturado. La solución es `(await promise.catch((e: unknown) => e)) as TargetType` — el cast externo al `await` permite inferencia correcta.
- **Refactor de useHealth:** El reemplazo del mock (`buildMockResponse` + `setTimeout` de 800ms) por `fetchHealthWithRetry` + `AbortController` fue completamente transparente para los tests existentes porque ambos testean las funciones puras, no el hook — validando la decisión de separar funciones puras del hook desde el Bloque 5.

### [2026-04-13] — Sesión: Bloque 7 - Stage-Gate y Cierre de Iteración 1
- **Auditoría:** El `stage-auditor` detectó ausencia de cert docs formales para B04/B05. La evidencia en `PROJECT_handoff.md` fue aceptada como compensación, pero la deuda documental fue registrada en `stage_audit_i1.md §HALLAZGO-Z01-01`.
- **Ghost Code check:** `tmp.md` encontrado en el working directory, pero está en `.gitignore` y no afecta el repositorio git.
- **Progreso:** 1/8 iteraciones completadas = 12.5% del roadmap. Latencia API medida: ~18ms (objetivo: < 300ms — 16× mejor que el umbral).

### [2026-04-14] — Sesión: Bloque 8 - Auth Schema & Security (Persistence Layer) ✅
- **Éxito Técnico:** Ciclo TDD completo ejecutado (RED → GREEN → REFACTOR → VAL → CERT) en Bloque 8 sin bloqueadores. 92 tests nuevos, todos GREEN.
- **Decisión Arquitectónica — Plain-Date Logic:** Se optó por usar `birthdate: string (YYYY-MM-DD)` en lugar de `Date` objects para evitar drift de zona horaria. Esto requiere lógica de validación de edad especial (cálculo de años calendario) que es leap-year aware. Justificación: coherencia en cálculos de edad entre frontend (JavaScript/cliente) y backend (Node.js), donde Date objects pueden divergir por UTC conversiones.
- **Decisión Arquitectónica — I18N Fallback:** `resolveLanguage()` extrae prefijos de locale (ej. `es-MX` → `es`) e implementa fallback automático a `'es'` para cualquier locale desconocida. Esto es más robusto que un rechazo explícito y cumple con RNF5 (default locale es español).
- **Decisión de Testing — Mock Clock en Purge Worker:** El Purge Worker requiere testing con Mock Clock para validar expiración de registros (7 días). Se implementó un modo in-memory para fallback cuando Redis no está disponible, permitiendo tests sin Docker.
- **Fricción Resuelta — Distributed Lock Ownership:** El Purge Worker usa Redis SET NX PX con TTL:600s, pero no valida si el proceso que intenta liberar el lock es el mismo que lo adquirió. Esto está documentado como WARN no-bloqueante (DT-B08-03) porque el riesgo es bajo en este contexto (purga diaria, no concurrencia intensiva).
- **Optimización — Log Sanitizer:** Implementación de `sanitizeLogData()` que enmascariza campos sensibles (password, token, otp) con `***` previene leaks en auditoría y logs. Esto es crítico para cumplimiento legal (GDPR/privacidad).
- **Recomendación Post-Bloque 8:** El Bloque 9 (Register) debe implementar persistencia física (Drizzle migrations) y endpoint `/api/auth/register`. Las utilidades de seguridad e I18N del Bloque 8 están listas para reutilización.

### [2026-04-14] — Sesión: Bloque 9 - Registro de Usuario & Safe Registry ✅
- **Éxito Técnico:** Ciclo TDD completo ejecutado (RED → GREEN → REFACTOR → VAL → CERT) sin bloqueadores. ~121 tests nuevos, todos GREEN. 24/24 contratos del `PROJECT_spec.md` verificados.
- **Decisión Arquitectónica — Clean Use Case:** `register_service.ts` es agnóstico de framework (no importa Next.js ni ORM). Recibe `RegisterRequest` (POJO) y retorna `RegisterResult` (statusCode + headers + body). El adaptador HTTP (`route.ts`) es deuda técnica conocida (DT-I2-B02-01).
- **Decisión de Privacidad — Anti-enumeración mediante 201 dummy:** En caso de colisión de email (email ya registrado), el servicio retorna 201 idéntico al éxito real, con un UUID dummy rotativo generado por `crypto.randomUUID()`. Esto hace imposible para un atacante distinguir entre un email nuevo y uno existente.
- **Decisión de Rate Limit — Fixed Window UTC (no deslizante):** El límite de 5 req/día usa reset a las 00:00 UTC exactas (calculado mediante `nextMidnightUtcEpoch()`), no una ventana de 24h deslizante. Esto simplifica la predictibilidad del limite para el usuario legítimo y es más fácil de razonar.
- **Decisión de Resiliencia — Fail-Closed con degradación graciosa dual:** (a) Redis caído en rate limiter → 503 SYSTEM_DEGRADED (Fail-Closed). (b) Email dispatch fallido → 201 con `warning_code: EMAIL_DISPATCH_FAILED` (degradación graciosa diferente). Ambos caminos son distintos; el primero es crítico, el segundo es best-effort.
- **Fricción de certificación — Fallo en `redis_resilience.test.ts`:** El test `[RED] checkRateLimit permite la 1ª peticion` falla porque el mock de ioredis rechaza `connect()`. Este fallo pertenece a B03 (Bloque 3, Iteración 1) y es una regresión preexistente, no bloqueante para B09. El `backend-reviewer` lo aisló formalmente en el reporte de certificación.
- **Deuda técnica menor — Magic Number `ONE_DAY_MS`:** `24 * 60 * 60 * 1000` aparece sin alias semántico en las líneas 440 y 461 de `register_service.ts`. Sin impacto funcional — los tests cubren el comportamiento correcto. Se extrae en la próxima iteración al crear el `route.ts`.
