# CLAUDE.md: SimpleRegister

Este archivo provee orientación a Claude Code (claude.ai/code) y a los agentes de Antigravity al trabajar con el código del proyecto **SimpleRegister** (Sistema de Registro con Validación de Mayoría de Edad).


## Configuración del Sistema de Agentes
* **Ubicación de Agentes:** Los perfiles de los agentes residen en `.claude/agents/` y sus habilidades técnicas en `.claude/skills/`.
* **Fuente de Verdad:** La configuración operativa de los agentes se encuentra en el directorio `.claude/` y la gobernanza documental en `docs/governance/`.
* **Instrucción de Operación:** Antes de comenzar cualquier tarea especializada, debes leer el archivo `.md` correspondiente dentro de `.claude/agents/` para adoptar el rol y las restricciones necesarias.
* **Persistencia:** Cualquier actualización de perfiles o habilidades debe realizarse dentro de la estructura de `.claude/`.


## Stack Tecnológico

| Capa                  | Tecnología                                                |
| --------------------- | --------------------------------------------------------- |
| **Unified Runtime**   | Next.js 15 (App Router), TypeScript 5+, Tailwind CSS      |
| **Persistencia**      | PostgreSQL 16 (Drizzle ORM), Multi-esquema (public/audit) |
| **Caché & Seguridad** | Redis (Sesiones, Rate Limiting, Listas de Revocación)     |
| **Infraestructura**   | Docker Compose (Optimizado para 2GB RAM), GitHub Actions  |
| **Notificaciones**    | SMTP con Backoff Exponencial (Resiliency Pattern)         |


## 🌐 Fuentes de Verdad Vivas (Live Context)

Para garantizar la paridad técnica con las versiones más recientes y eliminar el "vibecoding", el agente **DEBE** acceder y procesar estas URLs antes de proponer cambios en la `PROJECT_spec.md` o implementar lógica:

* **Next.js 15 (App Router & Server Actions):** [https://context7.com/vercel/next.js/llms.txt?tokens=10000](https://context7.com/vercel/next.js/llms.txt?tokens=10000)
* **Drizzle ORM (Type-safe SQL):** [https://context7.com/drizzle-team/drizzle-orm/llms.txt?tokens=10000](https://context7.com/drizzle-team/drizzle-orm/llms.txt?tokens=10000)

> **Directiva de Uso:** Si el agente detecta discrepancias entre su memoria interna y el contenido de estas URLs, la URL siempre prevalece como Fuente de Verdad.

## Arquitectura

Arquitectura de **Unified Runtime con Aislamiento de Capas**:

```
[ Frontend (Next.js 15) ] <---> [ API / Server Actions ] <---> [ Domain Services (Pure TS) ]
                                      ^              |              |
                                      |      [ Middleware (Redis) ] [ Drizzle ORM ]
                                      |              |              |
                                      |      [ PostgreSQL (Audit Schema + SHA-256) ]
                                      |______________|
```

- **Domain Services**: Lógica de negocio (edad, periodos de baja) desacoplada de Next.js (Clean Architecture).
- **Audit Scheme**: Registro inmutable de consentimientos legales con hashes SHA-256.
- **Resiliency**: Capacidad de degradación graciosa (Graceful Degradation) ante fallos de Redis.

## Esquema de Base de Datos Principal

Esquemas clave:
- `public.users`: Datos de perfil, `deleted_at`, `verified_at`, `birthdate`.
- `public.auth_sessions`: Gestión de sesiones y Refresh Tokens.
- `audit.consents`: Registro inmutable de aceptación de términos (identificado por SHA-256 del email).
- `audit.system_logs`: Trazabilidad técnica y auditoría legal.

## Reglas de Ejecución y Seguridad

- **Validación de Edad (RNF3)**: Obligatoria en el servidor (`Server-side`). Rechazo inmediato si < 18 años.
- **Periodo de Gracia (RF2)**: 30 días para reactivación antes de la purga física (`Hard Delete`).
- **Atomicidad Legal (RF4)**: Cambios críticos (ej. fecha nacimiento) solo permitidos cada 365 días y bajo transacciones SQL.
- **Rate Limiting (RNF7)**: 10 req/min por IP para acceso público; bypass exclusivo mediante `X-Health-Key` UUID.
- **Seguridad Fail-Closed (RNF9)**: Si el sistema de caché falla, el acceso a recursos protegidos debe bloquearse por defecto.
- **Aislamiento Docker**: Cuotas estrictas de RAM (Next.js: 512MB, Postgres: 256MB, Redis: 128MB).

## Contrato de Errores y Logs

- Uso de `Pino` para logging estructurado.
- Niveles: `info`, `warning`, `error`, `audit`.
- Respuestas API: Deben seguir el Estándar de Operación (SOP) definido en `PROJECT_spec.md`.

## Fases de Implementación (Hitos)
> **Trazabilidad:** Implementa [PROJECT_plan.md](docs/governance/PROJECT_plan.md) — Sección: *Hoja de Ruta de Entregables*.

1.  **Iteración 1: Cimientos (HEALTH)** — Infraestructura Docker, API de Salud y Dashboard de monitoreo.
2.  **Iteración 2: Registro (AUTH)** — Flujo de registro, validación de edad y verificación de email.
3.  **Iteración 3: Sesión (RECOVERY)** — Refresh Tokens, Revocación y Recuperación de cuenta.
4.  **Iteración 4: Perfil (DATA)** — Gestión de perfil obligatorio y bloqueo de navegación.
5.  **Iteración 5: Ciclo de Vida (PURGE)** — Baja voluntaria y purga automatizada de registros.

## Reglas de Comportamiento y Gobernanza

1.  **Mentalidad de Abogado del Diablo**: El agente debe cuestionar proactivamente la lógica buscando vacíos legales o contradicciones.
2.  **Soberanía Documental (SDD)**: El código es un reflejo **estricto** de la documentación. No se improvisa lógica sin `PROJECT_spec.md` autorizado.
3.  **Cadena de Confianza (Tokens)**: El inicio de cualquier tarea requiere un token de auditoría en estado **`AUTORIZADO`**.
4.  **Control de Cambios (CC) Obligatorio**: No se permite modificar la línea base autorizada (Gobernanza o etapas cerradas) sin el protocolo `change-control`.


## Soberanía Documental y SDD (Spec-Driven Development)
- El código es un reflejo estricto de la documentación. No se improvisa.
- **Ciclo de Vida:** `Entrevista de Requisitos` -> `Consulta de Live Context (URLs)` -> `Actualización de PROJECT_spec.md` -> `Aprobación de Spec` -> `Generación de Código`.
- Queda prohibido el uso de APIs obsoletas (ej. `getServerSideProps` en Next 15 o sintaxis de Prisma en Drizzle).

## Documentos de Gobernanza

Ubicados en `docs/governance/`:
- [PROJECT_scope.md](docs/governance/PROJECT_scope.md) — Requerimientos y Gherkin Criteria.
- [PROJECT_architecture.md](docs/governance/PROJECT_architecture.md) — Stack, cuotas de RAM y patrones.
- [PROJECT_plan.md](docs/governance/PROJECT_plan.md) — Hoja de ruta por iteraciones.
- [PROJECT_spec.md](docs/governance/PROJECT_spec.md) — Contratos técnicos y esquemas JSON.
- [PROJECT_backlog.md](docs/governance/PROJECT_backlog.md) — Lista atómica de tareas (TDD Flow).
- [PROJECT_executive.md](docs/governance/PROJECT_executive.md) — Bitácora acumulativa de valor de negocio.
- [PROJECT_handoff.md](docs/governance/PROJECT_handoff.md) — Punto de reanudación y estado de la sesión.
- [PROJECT_lessons.md](docs/governance/PROJECT_lessons.md) — Historial de lecciones aprendidas y retrospectiva.


## Protocolo de Control de Cambios (CC)

Gestionado bajo la regla estricta de **Soberanía y Cascada**:
1.  **Detección e Impacto**: Evaluar qué pilares (`Scope`, `Arch`, `Plan`) se ven afectados.
2.  **MODO CREATE**: Crear el detalle en `docs/changes/CC_XXXXX.md` y registrar en [change_index.md](audits/governance/change_index.md) como **Pendiente**.
3.  **MODO APPROVE/REJECT**: Requiere autorización explícita del usuario.
4.  **Efecto Cascada**: La aprobación de un cambio en el Alcance bloquea automáticamente (**🔴**) los tokens de Arquitectura, Plan y Spec, forzando una re-auditoría.
5.  **Trazabilidad**: Todo archivo modificado debe incluir en su pie de página la referencia al `CC_XXXXX` y generar nuevas tareas TDD en el Backlog.

## Agencia de Software Autónoma

Todo desarrollo sigue el flujo del **Protocolo de Granularidad Operativa**:
- **Protocolo**: `RED [Tester]` → `GREEN [Coder]` → `REFACTOR [Coder]` → `VAL [Tester]` → `CERT [Reviewer]`.
- **TDD Riguroso**: 70% Unit, 20% Integration, 10% E2E.

## Convenciones de Idioma

- **Código / Archivos / Carpetas**: Inglés (`snake_case` para archivos, `CamelCase` para clases).
- **Documentación / Comentarios / Commits**: Español.
- **Interfaz (UI) / Salida al Usuario**: Español.
- **Variables / Funciones**: Inglés.

## Protocolo de Gestión de Versiones (Git)

Operación bajo el flujo de **Soberanía de Ramas**:
1.  **Ramas de Estabilidad**: `main` y `dev` son de solo lectura. El código solo ingresa vía Pull Request (PR).
2.  **Ramas de Trabajo**: Nomenclatura obligatoria, basada en la iteracion y el bloque `feat/i[I]_b[B]_[nombre_corto]` (ej: `feat/i1_b1_infra_setup`).
3.  **Commits Semánticos (Español)**: `prefijo: descripción corta en minúsculas`.
    - `feat:` | `fix:` | `docs:` | `refactor:` | `test:` | `chore:`.
4.  **Sincronización**: Uso obligatorio de `git pull --rebase`. Prohibida la fuerza (`--force`) sin autorización.
5.  **Limpieza Pre-Push**: Solo se permite push con un `working tree clean`.

## Protocolo de Inicio y Cierre

### **Al Iniciar:**
1.  Leer `CLAUDE.md`.
2.  Consultar `docs/governance/PROJECT_handoff.md` para entender el estado actual del proyecto.
3.  Revisar estado de tokens de auditoría en `audits/governance/`.
4.  Consultar `PROJECT_backlog.md` para identificar la siguiente tarea unitaria.

### **Al Cerrar sesión:**
1.  Actualizar `PROJECT_backlog.md` con las tareas completadas `[x]`.
2.  Asegurar que las pruebas de la etapa actual pasen exitosamente.
3.  Reportar cualquier bloqueo o deuda técnica identificada.

## Indicador de Progreso

```
Progreso = (Tareas [x] / Tareas Totales) × 100%
```
*(Consultar `docs/governance/PROJECT_backlog.md` para el cálculo dinámico).*
