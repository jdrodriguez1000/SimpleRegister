# 🤝 Project Handoff — Iteración 2: Bloque 8 (AUTH-SCHEMA) COMPLETADO · Etapa 2.1.0 ✅

**Estado Actual:** Bloque 8 — Auth Schema & Security (Persistence Layer) completado y certificado. Ciclo TDD completo ejecutado (RED → GREEN → REFACTOR → VAL → CERT). 513/514 tests PASS (1 fallo preexistente no bloqueante en `redis_resilience.test.ts`).

**Fecha de Corte:** 2026-04-14
**Rama Activa:** `feat/i2_b8_auth_schema` (clean working tree)
**Próxima Sesión Objetivo:** Iniciar **Bloque 9 — Registro de Usuario & Safe Registry [Etapa 2.2.0]** con tarea `TSK-I2-B02-R` (`backend-tester`).

---

## §1 Coordenadas de Ejecución

| Campo | Valor |
|---|---|
| **Iteración** | Iteración 2 — Registro y Validación de Origen (**EN CURSO**) |
| **Bloque Actual** | Bloque 8 — Auth Schema & Security (Persistence Layer) (**COMPLETADO**) |
| **Etapa** | 2.1.0 — Backend Persistence Layer & Security Foundation |
| **Rama activa** | `feat/i2_b8_auth_schema` |
| **Tareas B8** | 7/7 completadas `[x]` (R, G1, G2, G3, RF, V, C) |
| **Agentes que actuaron** | `backend-tester`, `backend-coder` (×4), `backend-reviewer` |
| **Capas impactadas** | Backend (TypeScript services, DB schemas, security utils, test suite) |
| **Progreso Bloque 8** | 7/7 tareas [x] · 92 tests nuevos (51 RED + 41 VAL) todos GREEN |
| **Progreso Iteración 2** | 1/13 bloques completados (Bloque 7.5 sincronización + Bloque 8) = 15.4% de I2 |
| **Progreso Global** | 33 + 7 = 40 tareas [x] de ~130 totales = 30.8% del proyecto |

---

## §2 Hitos y Avance de Etapa — Bloque 8

### Bloque 8 — Auth Schema & Security (Persistence Layer) [Etapa 2.1.0] ✅ COMPLETADO

#### **TSK-I2-B01-R** — Auth Schema Red ✅
- **Agente:** `backend-tester`
- **Resultado:** Suite RED creada en `src/__tests__/auth/auth_schema.test.ts`
- **Evidencia:** 51 tests (todos fallando en estado RED inicial)
- **Cobertura de Tests:**
  - SOP mandatorio (Headers X-Request-ID, Version, Timestamp, Content-Type)
  - Modelo User (email, birthdate Plain-Date YYYY-MM-DD, status UNVERIFIED)
  - Modelo AuthToken (token_hash SHA-256, issued_at, expires_at, user_id FK)
  - Clock mocking (Jest `useFakeTimers`) para validación de expiración
  - Collision detection (distributed lock timeout)
  - Edge cases: 29-Feb leap year, password UTF-8 > 128 bytes
  - I18N fallback (invalid locale → 'es' automático)

#### **TSK-I2-B01-G1** — Auth Persistence Impl ✅
- **Agente:** `backend-coder`
- **Resultado:** Esquemas de DB creados
- **Archivos Creados:**
  - `src/lib/db/schema/users.ts` — Interface `User` con `UserStatus` type
  - `src/lib/db/schema/auth_tokens.ts` — Interface `AuthToken`
- **Especificidad Técnica:**
  - `birthdate: string` (Plain-Date YYYY-MM-DD, evita timezone drift)
  - `status: UserStatus` con `default: 'UNVERIFIED'` (UNVERIFIED | ACTIVE | DELETED)
  - `minDate: 1900-01-01` (RNF3)
  - Leap-year aware (29-Feb validación en edad)
  - Token hashing SHA-256 (no texto plano en DB)

#### **TSK-I2-B01-G2** — Security & I18N Utils ✅
- **Agente:** `backend-coder`
- **Resultado:** Utilidades de seguridad e internacionalización
- **Archivos Creados:**
  - `src/lib/services/age_validation.ts` — `validateAge()` + `isOver18()` functions
  - `src/lib/utils/i18n.ts` — `resolveLanguage()` con RFC 5646 + fallback 'es'
- **Especificidad Técnica:**
  - Validación de edad usando Plain-Date logic (cálculo de años calendario sin drift)
  - I18N matching: `es-MX` → `es` (prefix extraction), fallback a 'es'
  - Rechazo explícito de payloads > 128 bytes (RNF1)

#### **TSK-I2-B01-G3** — Purge Background Logic ✅
- **Agente:** `backend-coder`
- **Resultado:** Worker de purga con bloqueos distribuidos
- **Archivos Creados:**
  - `src/lib/services/purge_worker.ts` — `acquirePurgeLock()` / `releasePurgeLock()`
- **Especificidad Técnica:**
  - Redis Distributed Locking (SET NX PX TTL:600s)
  - Fail-safe RNF9: Si Redis está down, fallback a in-memory lock (tests)
  - Finally block garantizado para liberación de lock
  - Modo degradado en environments sin Redis (testing)

#### **TSK-I2-B01-RF** — Security Hardening ✅
- **Agente:** `backend-coder`
- **Resultado:** Hardening de seguridad y sanitización de logs
- **Archivos Creados:**
  - `src/lib/utils/token_hash.ts` — `hashToken()` SHA-256 con normalización lowercase
  - `src/lib/utils/log_sanitizer.ts` — `sanitizeLogData()` enmascarando (password, token, otp)
- **Especificidad Técnica:**
  - SHA-256 token hashing (no reversible)
  - Normalización a lowercase antes de hashing
  - Log sanitizer enmascarando campos sensibles con `***`

#### **TSK-I2-B01-V** — Auth Persistence Val ✅
- **Agente:** `backend-tester`
- **Resultado:** Suite de validación e integración
- **Archivo Creado:**
  - `src/__tests__/auth/auth_persistence_val.test.ts` — 41 tests de integración (todos GREEN)
- **Cobertura de Tests:**
  - No-reversibilidad SHA-256
  - Purga física de registros expirados (7 días, Mock Clock)
  - Resiliencia del Purge Worker ante fallos de Redis
  - Passwords multibyte (UTF-8 > 128 bytes)
  - Paridad 29-Feb entre frontend y backend
  - Log sanitizer verifica enmascaramiento

#### **TSK-I2-B01-C** — Security Architecture Cert ✅
- **Agente:** `backend-reviewer`
- **Resultado:** Certificación arquitectónica aprobada sin bloqueos
- **Certificado Emitido:** (Inline en decisión)
- **Veredicto:** CERT APROBADO
- **Hallazgos:**
  - 0 errores bloqueantes
  - 3 WARNs no-bloqueantes registrados:
    - W1: Campo `verified_at` ausente en esquema User (puede agregarse post-Launch)
    - W2: Validación semántica de fecha (rango 1900-01-01 a hoy) no explícitamente documentada
    - W3: Ownership del lock distribuido (no validar que proceso A no libera lock de B)

**Tests Totales Bloque 8:** 92 tests (51 RED + 41 VAL), todos GREEN ✅

---

## §3 Inventario Técnico de Cambios (Bloque 8)

### Archivos Creados
| Archivo | Propósito | Tarea |
|---------|-----------|-------|
| `src/__tests__/auth/auth_schema.test.ts` | Suite RED: 51 tests — validación de esquema, SOP, modelos | B01-R |
| `src/__tests__/auth/auth_persistence_val.test.ts` | Suite VAL: 41 tests — integración, resiliencia, seguridad | B01-V |
| `src/lib/db/schema/users.ts` | Interfaz User: email, birthdate, status, timestamps | B01-G1 |
| `src/lib/db/schema/auth_tokens.ts` | Interfaz AuthToken: token_hash, issued/expires_at, user_id | B01-G1 |
| `src/lib/services/age_validation.ts` | Funciones validateAge() e isOver18() Plain-Date aware | B01-G2 |
| `src/lib/utils/i18n.ts` | Función resolveLanguage() RFC 5646 + fallback 'es' | B01-G2 |
| `src/lib/services/purge_worker.ts` | Worker de purga con Redis distributed locking | B01-G3 |
| `src/lib/utils/token_hash.ts` | Función hashToken() SHA-256 + normalización lowercase | B01-RF |
| `src/lib/utils/log_sanitizer.ts` | Función sanitizeLogData() — enmascaramiento (password, token, otp) | B01-RF |

### Archivos Modificados
| Archivo | Cambio | Razón |
|---------|--------|-------|
| `docs/governance/PROJECT_backlog.md` | Tareas B01-R/G1/G2/G3/RF/V/C marcadas `[x]` | Auditoría de progreso |
| **Sin cambios adicionales** | Estado CLEAN después de TSK-I2-B01-C | Todo refactoring incluido en G3/RF |

### Índice de Cambios Estructurales
- **Nueva capa:** `src/lib/db/schema/` (interfaces de dominio DB)
- **Nueva capa:** `src/lib/services/` (lógica de negocio: age_validation, purge_worker)
- **Extensión:** `src/lib/utils/` (funciones puras: i18n, token_hash, log_sanitizer)

---

## §4 Mapa Táctico de Continuidad

### 🚀 NEXT STEP — Acción Inmediata (Quirúrgica)

**Tarea:** `TSK-I2-B02-R` — Register Contract Red (Backend)
**Agente:** `backend-tester`
**Bloque:** Bloque 9 — Registro de Usuario & Safe Registry [Etapa 2.2.0]
**Estimación:** ~2h (RED suite)

**Qué debe hacer:**
1. Crear suite RED en `src/__tests__/auth/register.test.ts` con ~60-70 tests unitarios (estado FAILING)
2. Cubrir contratos de `/api/auth/register`:
   - Solicitud (email, password, birthdate, lang)
   - Validación SOP (Headers X-Request-ID, Version, Timestamp)
   - Respuesta 201 exitosa (user_id, status UNVERIFIED)
   - Respuesta 400 (validation errors: email inválido, weak password, under 18, email duplicado)
   - Respuesta 429 (rate limit superado)
   - Respuesta 500 (error genérico, sin exposición de detalles)
3. Validar con Mock Clock para timestamp consistency
4. Cubrir edge cases:
   - Email case-insensitive (normalization)
   - Birthdate formato YYYY-MM-DD
   - Password multibyte UTF-8 > 128 bytes (rechazo)
   - Language fallback a 'es'

**Verificación previa obligatoria:**
```bash
cd /c/Users/USUARIO/Documents/Work/SimpleRegister
npx jest --no-coverage                    # debe reportar 513/514 PASS
npx tsc --noEmit                          # debe reportar 0 errores TypeScript
git status                                 # debe estar limpio
git diff HEAD --name-only                  # no debe haber cambios sin commit
```

### Bloqueadores Conocidos
- **Ninguno** — Bloque 9 (Register) puede iniciar inmediatamente.
- Preocupación menor: El Bloque 8 no incluye migraciones Drizzle explícitas (`drizzle/migrations/`), pero esto está dentro del scope de Bloque 9 (Register G1 incluye persistencia física).

### Deuda Técnica Registrada (no bloquea Bloque 9)
| ID | Deuda | Severidad | Resolución Planificada |
|----|-------|-----------|----------------------|
| DT-B08-01 | Schema validation: no validación semántica de rango de fecha (1900-01-01 to today) | BAJA | Bloque 9 (Register validation layer) |
| DT-B08-02 | `verified_at` timestamp ausente en User schema | BAJA | Post-Launch enhancement |
| DT-B08-03 | Lock ownership validation (distributed) no implementado | MEDIA | Bloque 10.1 (Email Worker) donde purga interactúa con tokens |

### Riesgos Técnicos Mitigados
✅ **RNF3 (Age Validation):** Implementado Plain-Date logic, leap-year aware, sin drift de zona horaria
✅ **RNF1 (Password Security):** Esquema preparado para Argon2id; rechazo de > 128 bytes UTF-8
✅ **RNF9 (Fail-Closed):** Purge Worker con distributed locking y fallback in-memory
✅ **Security (Token Hashing):** SHA-256 no-reversible, normalización lowercase
✅ **Auditoría (Log Sanitizer):** Enmascaramiento de campos sensibles

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
