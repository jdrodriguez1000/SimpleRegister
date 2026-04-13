# 📚 Lessons Learned — SimpleRegister

> Diario histórico de ingeniería del proyecto. **PROHIBIDA** la modificación o eliminación de entradas anteriores.
> Cada entrada es un activo de conocimiento irrevocable.

---

## Sesión: 2026-04-12 (Fase 1 / Etapa 1.0.0 — Gobernanza & Kickoff)

### ✅ Éxitos y Aciertos Técnicos
- El protocolo **Devil's Advocate** en la revisión de `PROJECT_spec.md` detectó 2 gaps críticos antes de escribir una línea de código: ausencia del Regex UUIDv4 para `X-Health-Key` y ambigüedad en el formato del campo `api_latency_ms`. Ambos corregidos en la Spec antes del desarrollo.
- El diseño de agentes **agnósticos de framework** (perfiles que referencian habilidades genéricas) facilitó la asignación de responsabilidades sin acoplamiento a tecnologías específicas desde el día uno.

### ⚠️ Fricciones y Desafíos
- **Windows + Git Bash (MINGW64):** PowerShell no acepta el operador `&&` para encadenar comandos. Se requiere `;` o invocaciones separadas en entornos Windows. Afecta a todos los agentes al construir comandos de shell.

### 💡 Lección Clave
> **Invertir en la Spec antes del código es la optimización más rentable.** Cada campo ambiguo en la Spec se convierte en un bug de regresión en la fase de certificación. La revisión adversarial (Devil's Advocate) en la documentación debe ser un prerequisito no negociable antes de cualquier implementación.

---

## Sesión: 2026-04-12 (Fase 1 / Etapa 1.1.0 — Bloque 1: Infraestructura y Entorno)

### ✅ Éxitos y Aciertos Técnicos

1. **Validación TCP con Node.js `net` module:** Usar `node -e "const net=require('net')..."` dentro de contenedores Alpine es el método canónico y portable para tests de conectividad TCP. Funciona en cualquier imagen que tenga Node.js, sin dependencia de bash ni de `nc`/`nmap`.

2. **Setup UUIDs multiplataforma con fallback chain:** El patrón `node crypto.randomUUID()` → `python3 uuid` → `uuidgen` → `powershell` → `/dev/urandom` garantiza generación correcta de UUIDv4 en cualquier entorno del equipo (Linux, macOS, Windows/MINGW64). El UUID generado fue validado contra el Regex estricto de la Spec antes de inyectarse en `.env`.

3. **`setup_env.sh` con protección de sobreescritura:** Verificar la existencia de `.env` antes de generar uno nuevo previene la destrucción accidental de credenciales de desarrollo ya configuradas. Este patrón debe replicarse en cualquier script de inicialización futuro.

4. **Scaffold mínimo de Next.js como responsabilidad del `devops-integrator`:** El devops debe crear los artefactos mínimos necesarios para que el Dockerfile compile, incluso antes de que el `frontend-coder` inicie su trabajo. Esto desacopla la validación de infraestructura del ciclo TDD del frontend.

5. **Docker `depends_on: condition: service_healthy`:** Usar la condición `service_healthy` en lugar de `service_started` garantiza que la app no inicie hasta que DB y Redis estén genuinamente listos. Ahorra tiempo de diagnóstico en entornos de CI/CD.

6. **Certificación in-situ de menores:** El `backend-reviewer` puede aplicar correctivos menores (dead code, patrones ambiguos) durante la certificación sin necesidad de devolver la tarea. Esto acelera el ciclo sin comprometer la calidad.

### ⚠️ Fricciones y Desafíos

1. **`/dev/tcp` no disponible en Alpine (`ash`):** La primera versión de `connectivity_test.sh` usó `(echo >/dev/tcp/host/port)` para los tests TCP 1.1 y 2.1. Al ejecutarse en contenedores `node:20-alpine`, Alpine usa `ash` (no bash), que no soporta el pseudo-device `/dev/tcp`. Resultado: 2 tests fallaron (FAIL) a pesar de que la conectividad real estaba funcionando (pg_isready y redis-cli PONG pasaron). **Coste:** Una iteración extra de diagnóstico y corrección. **Resolución:** Reemplazar por `node net.createConnection()` — más robusto y explícito.

2. **`DATABASE_URL` con placeholder post-setup:** El script `setup_env.sh` sólo inyectó `X_HEALTH_KEY` pero no actualizó `DATABASE_URL`, que quedó con `CHANGE_ME_STRONG_DB_PASSWORD`. Fue necesario un paso manual de corrección antes de poder levantar los contenedores. **Mejora propuesta para Iteración 2:** El `setup_env.sh` debe generar también `POSTGRES_PASSWORD` de forma aleatoria y actualizar `DATABASE_URL` de manera consistente en un solo paso atómico.

3. **Glob permisivo `package-lock.json*` en Dockerfile:** El patrón oficial de Next.js para el COPY del lockfile usa el glob `*` para tolerar su ausencia, pero esto hace fallar a `npm ci` más tarde con un error menos descriptivo. Se corrigió a `COPY package.json package-lock.json ./` para fallo explícito y temprano en el stage COPY.

4. **Cuotas RAM de `deploy.resources` en Docker Compose sin Swarm:** En Docker Compose V2 moderno, `deploy.resources.limits.memory` funciona sin necesidad del flag `--compatibility`. Verificado: `sr_db` con 268435456 bytes (256MB exacto) y `sr_redis` con 134217728 bytes (128MB exacto). Sin embargo, en instalaciones con Docker Compose V1 antiguo, esto requeriría la flag. **Recomendación:** Documentar en el README que se requiere Docker Compose V2+ (`docker compose`, no `docker-compose`).

### 💡 Lecciones Clave

> **Lección 1 — Tests de conectividad en Alpine siempre con Node.js `net`:**
> Nunca asumir que `/dev/tcp` está disponible en un contenedor Alpine. El pseudo-device es específico de bash. El patrón correcto es `node -e "const net=require('net'); ..."` — portable, sin dependencias externas, y produce mensajes de error claros.

> **Lección 2 — `setup_env.sh` debe ser atómico:**
> Un script de setup de entorno que no actualiza todas las variables interdependientes en un solo paso (ej. `POSTGRES_PASSWORD` y `DATABASE_URL` juntos) genera deuda operativa inmediata. La atomicidad del setup es tan importante como la atomicidad de las transacciones de base de datos.

> **Lección 3 — El `devops-integrator` necesita scaffold de aplicación:**
> La infraestructura Docker no puede certificarse sin una aplicación mínima buildable. El `devops-integrator` debe tener claridad sobre qué mínimo de scaffold de app necesita para completar su tarea, y coordinarse explícitamente con el `frontend-coder` antes de B01-G para evitar solapamiento.

---

## Sesión: 2026-04-12 (Fase 1 / Etapa 1.3.0 — Bloque 3: Resiliencia y Rate Limiting)

### ✅ Éxitos y Aciertos Técnicos
- **Bypass de Rate Limit mediante Headers:** Implementar un bypass explícito para `X-Health-Key` en el middleware de Rate Limit permite que los monitores de salud no se vean bloqueados por su propia frecuencia de escaneo, garantizando observabilidad continua incluso bajo ataque.
- **Interceptores de Fallback para Resiliencia:** El uso de bloques try/catch focalizados en el acceso a Redis permite que el middleware de Rate Limit degrade su comportamiento a "permitir todo" o "bloquear selectivo" en lugar de tirar el servidor. Se validó mediante `docker stop redis`.
- **Validación de Caos en TDD:** Integrar la detención de contenedores como parte de la fase de validación (B03-V) forzó a que el código de producción fuera genuinamente resiliente desde su concepción, no como un parche posterior.

### ⚠️ Fricciones y Desafíos
- **Persistencia de Contadores en Caídas de Redis:** Durante los tests de caos, se detectó que si Redis cae y vuelve a subir, los contadores de Rate Limit se resetean (esperado), pero la transición de "Error de Conexión" a "Reconexión Exitosa" de la librería cliente puede generar latencias de bloqueo (hang) si no se configuran correctamente los timeouts de conexión.
- **Latencia de Redis en Redes Docker:** Se observó que la latencia reportada por `health_latency_ms` para Redis a veces fluctuaba por encima de los 10ms debido a la resolución de nombres interna de Docker. Se recomienda usar la IP del servicio si la latencia se vuelve un problema crítico.

### 💡 Lección Clave
> **La resiliencia no es una feature, es una propiedad del sistema.** No basta con atrapar errores; se debe definir qué significa para el negocio un "estado degradado" y asegurar que el contrato de API se mantenga intacto (payload consistente) incluso cuando el backend está a medias. El test de caos es la única métrica real de resiliencia.

---

## Sesión: 2026-04-13 (Fase 1 / Etapas 1.4.0 y 1.5.0 — Bloques 4 y 5: Frontend Bootstrap + UI Logic)

### ✅ Éxitos y Aciertos Técnicos

1. **Separación de tipos consumidor / proveedor como primera decisión de arquitectura FE:** Crear `types/health.ts` en la raíz (para el frontend) separado de `src/lib/types/health_types.ts` (backend) desde el primer commit evitó el acoplamiento entre capas. El principio "el consumidor define su contrato" simplificó enormemente los tests y permitió que los tipos FE evolucionen independientemente de la implementación del servidor.

2. **Funciones puras exportadas junto al hook — testabilidad en Node sin DOM:** Exportar `computeSLALevel`, `getInitialState` y `applyHealthResponse` como funciones puras desde `useHealth.ts` permitió un ciclo TDD completo (46 tests) en el entorno Node de Jest, sin necesidad de instalar `jsdom` ni `@testing-library/react`. El hook (`useHealth`) usa estas funciones internamente pero no es el objetivo de los tests unitarios de esta etapa.

3. **Tablas de datos (`STATUS_CONFIG`, `SLA_COLOR`) como fuente de verdad visual:** Definir los mapeos de `ServiceStatus → dotClass/label` y `SLALevel → CSS variable` como constantes en los componentes (no hardcodeadas en JSX) permitió validarlos directamente en los tests de `visual_states.test.ts` con `readFileSync`. Esto crea un contrato de color verificable sin necesidad de renderizado DOM.

4. **Boundary Server/Client en Next.js 15 — `page.tsx` como cáscara:** El patrón de mantener `page.tsx` como Server Component puro (solo renderiza `<HealthDashboard />`) y aislar `'use client'` en el componente de composición es el patrón óptimo para Next.js App Router. Reduce el bundle de JavaScript enviado al cliente y preserva la capacidad de SSR/SSG para la ruta raíz.

5. **Animación skeleton 60fps con solo `opacity`:** Animar exclusivamente la propiedad `opacity` (0.4 ↔ 1.0) en el `@keyframes skeleton-pulse` garantiza que la animación se ejecute en el compositor GPU del navegador, sin disparar layout ni paint. La curva `cubic-bezier(0.4, 0, 0.6, 1)` (Material Design ease-in-out) produce una percepción de fluidez significativamente mejor que `ease` o `linear`.

6. **Audit de certifación como código ejecutable:** El `frontend-reviewer` ejecutó la auditoría de TSK-I1-F01-C y TSK-I1-F02-C mediante scripts Node que leen y validan los archivos del proyecto (no solo revisión visual del código). Este patrón hace la certificación repetible, trazable y libre de sesgo humano para las propiedades estructurales.

### ⚠️ Fricciones y Desafíos

1. **`import type` no genera estado RED en ts-jest (transpileModule):** Para el estado RED de las suites de arquitectura (`arch_config.test.ts`) se usó inicialmente `import type { ... } from '@/types/health'`. ts-jest en modo `transpileModule` elimina los imports de tipo en compilación sin verificar si el módulo existe, por lo que el test no falla por "Cannot find module" — simplemente ejecuta y los valores de tipo se infieren como `string`. **Solución:** Para el RED de módulos FE, usar siempre imports de valor (`import { ... }`) que sí generan error de resolución de módulo en runtime.

2. **Flag `s` (dotAll) de regex bloqueado por `target: ES2017` en tsconfig:** Los tests de `visual_states.test.ts` usaron el flag `s` para hacer que `.` en regex coincida con saltos de línea (necesario para validar bloques CSS multi-línea). Con `target: "ES2017"`, `tsc --noEmit` reportó TS1501. **Solución:** Actualizar `target` a `"ES2018"` — correcto para Next.js 15 que transpila para navegadores modernos. Sin efectos secundarios detectados.

3. **Regex en auditoría de certificación con falso positivo por llaves anidadas CSS:** El check de "keyframes NO anima propiedades de layout" usó el regex `/@keyframes skeleton-pulse[\s\S]*?(width|height|margin|padding)[\s\S]*?\}/m` que no maneja correctamente las llaves anidadas de los keyframe-selectors (`0%, 100% { ... }`). El regex escapó del bloque keyframes y encontró `padding` en `.skeleton-card`. **Resolución:** Escribir un extractor de bloque CSS con conteo de profundidad de llaves para aislar exactamente el contenido del `@keyframes`. El bloque real solo contiene `opacity` — animación válida 60fps.

4. **Inconsistencia de documentación en SkeletonDashboard:** El comentario del archivo decía "Skeleton loaders para los 3 indicadores" (literal del spec), cuando la implementación correcta renderiza 4 servicios. El spec menciona "3 indicadores" probablemente refiriéndose a los servicios críticos visibles en el estado público, pero el dashboard privado muestra los 4. El `frontend-reviewer` lo detectó y corrigió durante TSK-I1-F02-C.

### 💡 Lecciones Clave

> **Lección 1 — Para RED de módulos FE, usa import de valor, no `import type`:**
> `import type { X } from '@/missing-module'` es eliminado por ts-jest en transpileModule antes de que Node intente resolver el módulo. Solo `import { X } from '@/missing-module'` (import de valor) genera el error "Cannot find module" que fuerza el estado RED. Esta distinción es crítica para el flujo TDD con módulos TypeScript.

> **Lección 2 — Las tablas de mapeo (STATUS_CONFIG, SLA_COLOR) son la "Spec visual hecha código":**
> Definir los mapeos `estado → apariencia` como constantes exportables (no como ternarios inline en JSX) transforma las decisiones de diseño visual en contratos verificables automáticamente. Los tests pueden leer el código fuente y confirmar que los colores correctos están asignados a cada estado, sin necesitar renderizado. Aplicar este patrón a todos los mapeos de presentación en Iteración 2.

> **Lección 3 — Los audits de certificación deben manejar estructuras anidadas con parsers, no regex planos:**
> Un regex que busca una propiedad dentro de un bloque CSS puede "escapar" si el bloque tiene llaves anidadas. Para validar contenido dentro de estructuras delimitadas (CSS `@keyframes`, JSON, HTML), usar un parser o un extractor por conteo de profundidad. Los falsos positivos en la auditoría erosionan la confianza en el proceso de certificación.

---

## Sesión: 2026-04-13 (Fase 1 / Etapa 1.6.0 — Bloque 6: Capa de Integración & Resiliencia FE)

### ✅ Éxitos y Aciertos Técnicos

1. **`FetchHealthError` como clase estructurada con `Object.setPrototypeOf`:** Extender `Error` con metadatos HTTP (`statusCode`, `errorCode`, `retryAfterMs`, `response`) en una sola clase proporciona un contrato de error tipado y compatible con `instanceof` incluso al transpilar a CommonJS (ts-jest). Este patrón es reutilizable para todos los clientes HTTP del proyecto (Auth, Register en Iteración 2).

2. **`shouldRetry` y `buildExponentialDelay` como funciones puras exportadas:** Separar la lógica de decisión de reintento y el cálculo de delay del bucle de `fetchHealthWithRetry` permite testearlas de forma completamente aislada (sin mocks, sin efectos secundarios). El resultado: 12 tests de pureza que ejecutan en <1ms cada uno y documentan el comportamiento esperado con más precisión que cualquier comentario.

3. **`AbortController` en `useHealth` — cleanup correcto de `useEffect`:** Retornar `() => controller.abort()` desde el callback de `useCallback` y usarlo como cleanup de `useEffect` previene actualizaciones de estado en componentes desmontados sin necesidad de una variable `isMounted`. Es el patrón idiomático de React 18+ para cancelación de fetch.

4. **Refactor transparente al mock gracias a la separación de capas del Bloque 5:** Reemplazar `buildMockResponse` + `setTimeout` por `fetchHealthWithRetry` en `useHealth.ts` no rompió ningún test existente (144 tests del Bloque 5 siguieron GREEN) porque todos testean las funciones puras, no el hook. La arquitectura de "funciones puras + hook consumidor" diseñada en el Bloque 5 demostró ser la decisión correcta.

5. **Patrón "settled promise" para tests de retry con `jest.useFakeTimers()`:** Convertir la promesa a un objeto `{ok, value/error}` ANTES de correr `jest.runAllTimersAsync()` elimina el problema de "unhandled rejection" en Jest 30. Este patrón es la solución canónica para testear código que rechaza promesas durante la ejecución de timers falsos.

### ⚠️ Fricciones y Desafíos

1. **Jest 30 + `await jest.runAllTimersAsync()` + promesa rechazada = unhandled rejection:** Si una promesa rechaza durante la ejecución de `jest.runAllTimersAsync()`, Jest 30 la marca como "unhandled" antes de que el `await expect(promise).rejects` en la línea siguiente pueda capturarla. El test falla con la excepción en lugar de con un assertion error. **Solución confirmada:** `const settled = promise.then(v => ({ok: true, value: v})).catch(e => ({ok: false, error: e})); await jest.runAllTimersAsync(); const result = await settled;` — convierte la promesa a un valor antes de correr los timers.

2. **TypeScript: `.catch(e => e as SomeType)` crea una unión no esperada:** Al hacer `fetchHealth().catch(e => e as FetchHealthError)`, TypeScript infiere el tipo de retorno como `Promise<HealthCheckResponse | FetchHealthError>`. Acceder a `.retryAfterMs` falla porque `HealthCheckResponse` no tiene esa propiedad. **Solución confirmada:** `(await fetchHealth().catch((e: unknown) => e)) as FetchHealthError` — el cast externo al `await` da el tipo correcto.

3. **`HEALTH_ENDPOINT = '/api/v1/health'` relativo funciona en browser pero no en SSR:** Si en algún momento `useHealth` se convierte a un Server Component o se usa en un contexto de SSR, el fetch relativo fallará (Node no tiene base URL implícita). Por ahora es seguro porque `HealthDashboard` tiene `'use client'`. Registrado como riesgo latente para Iteración 2 si el patrón de fetch cambia.

### 💡 Lecciones Clave

> **Lección 1 — El "settled promise" pattern es obligatorio para tests de retry con fake timers en Jest 30:**
> `await expect(promise).rejects` no puede capturar un rechazo que ocurre DURANTE `await jest.runAllTimersAsync()`. El patrón correcto es: (1) convertir la promesa a un objeto settled antes de correr los timers, (2) correr los timers, (3) verificar el objeto settled. Estandarizar este patrón en todos los tests de retry de las iteraciones siguientes.

> **Lección 2 — Capas bien separadas = refactors baratos:**
> El reemplazo del mock por la API real en `useHealth.ts` costó ~20 líneas de código y 0 tests rotos. El precio de este refactor barato fue invertido durante el Bloque 5 al exportar funciones puras desde el hook. La arquitectura de "lógica pura + efecto orquestador" paga dividendos desde el primer refactor.

> **Lección 3 — `FetchHealthError` es el patrón de error HTTP del proyecto:**
> Toda llamada HTTP del proyecto (Iteraciones 2–8) debe seguir el patrón: `class XxxError extends Error { statusCode, errorCode, response?, retryAfterMs? }` con `Object.setPrototypeOf`. Esto garantiza `instanceof` correcto, tipado estructurado y metadata de reintento sin depender de librerías externas.

---

## Sesión: 2026-04-13 (Fase 1 / Etapa 1.7.0 — Bloque 7: Stage-Gate y Cierre de Iteración 1)

### ✅ Éxitos y Aciertos Técnicos

1. **El proceso de Stage-Gate detectó deuda documental real:** La auditoría del `stage-auditor` identificó que los cert docs de B04 y B05 no existían como archivos independientes — solo en el `PROJECT_handoff.md`. La evidencia compensatoria (tests + handoff) fue aceptada, pero la deuda quedó registrada. El proceso de auditoría funciona como sistema de detección, no solo de validación.

2. **Traducción Tech-to-Business como ejercicio de claridad:** Escribir el Executive Summary obligó a reformular cada logro técnico en términos de valor perceptible para el negocio (ej. "18ms de latencia" → "16× más rápido que el objetivo"). Este ejercicio reveló que la métrica de latencia es la más impactante y comunicable de la iteración.

3. **`PROJECT_handoff.md` como fuente de verdad de estado:** El `stage-auditor` utilizó el `PROJECT_handoff.md` como evidencia compensatoria para las certifcaciones de B04/B05. Esto confirma que el handoff no solo facilita la continuidad entre sesiones, sino que también actúa como registro de auditoría informal.

### ⚠️ Fricciones y Desafíos

1. **Cert docs de B04/B05 no generados como artefactos independientes:** Las certificaciones de `TSK-I1-F01-C` y `TSK-I1-F02-C` fueron documentadas en el `PROJECT_handoff.md` pero no generaron archivos `cert_*.md` en `audits/`. El `stage-auditor` lo detectó como `HALLAZGO-Z01-01`. **Causa:** Los agentes `frontend-reviewer` que ejecutaron B04-C y B05-C en sesiones anteriores no tenían el patrón de generación de cert docs explícito en su protocolo. **Prevención:** Añadir en el perfil de `frontend-reviewer` una instrucción explícita de crear `audits/governance/cert_fe_[bloque].md` como parte del DoD de toda tarea CERT.

2. **`tmp.md` en working directory:** Archivo de configuración de otro proyecto (DonTolto) encontrado en la raíz del repositorio local. No comprometido a git (en `.gitignore`). El usuario informó que será eliminado manualmente. No genera riesgo técnico pero sí de confusión para agentes futuros si no se elimina.

### 💡 Lecciones Clave

> **Lección 1 — Todo agente CERT debe generar un artefacto físico en `audits/`:**
> Una certificación sin documento independiente en `audits/` es invisible para la auditoría técnica de etapa. La regla debe ser: `frontend-reviewer` (y cualquier reviewer) crea siempre un archivo `cert_[tipo]_[bloque].md` en `audits/` como parte obligatoria de su DoD, no opcional. Actualizar los perfiles de agente reviewer para reflejar esto.

> **Lección 2 — El latency benchmark es el KPI más comunicable de la Iteración 1:**
> "18ms de latencia vs 300ms objetivo" es una métrica de impacto inmediato para cualquier stakeholder técnico o de negocio. Para las iteraciones siguientes, definir un KPI análogo (ej. "tiempo de registro", "tasa de éxito de verificación de email") antes de iniciar el desarrollo, para que el Executive Summary tenga un número análogo de impacto.

> **Lección 3 — La Iteración 1 valida el pipeline completo de agentes:**
> Los 7 bloques ejecutados con 10 agentes especializados, 422 tests automatizados, TypeScript estricto y documentación de gobernanza completa demuestran que el protocolo `RED→GREEN→REFACTOR→VAL→CERT` es viable y produce entregables de calidad. El costo de governance (audit, handoff, lessons) es ~15% del esfuerzo total y protege el 100% del trabajo técnico.
