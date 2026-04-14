# Directorio Maestro de Agentes (SMM)

Este documento centraliza el catálogo de especialistas de IA disponibles para el proyecto **SimpleRegister**. Cada agente posee una personalidad, herramientas y protocolos específicos para garantizar la calidad y gobernanza del desarrollo.

---

## 🤖 Catálogo de Especialistas

| Agente                | Rol Principal                 | Habilidades Clave                                                | Triggers Comunes                                                        |
| :-------------------- | :---------------------------- | :--------------------------------------------------------------- | :---------------------------------------------------------------------- |
| **session-closer**    | Guardián de la Continuidad    | `session-close-handoff`<br>`session-close-lessons`               | *"cerramos por hoy"*, *"handoff"*, *"lecciones learned"*                |
| **stage-auditor**     | Quality Gate Técnico          | `stage-audit`                                                    | *"audita la etapa"*, *"verificar DoD"*, *"revisar conformidad"*         |
| **stage-closer**      | Notario de Valor de Negocio   | `stage-close`                                                    | *"resumen ejecutivo"*, *"cerrar etapa"*, *"finalize stage"*             |
| **devops-integrator** | Arquitecto de Infraestructura | `docker-lifecycle`<br>`secrets-guard`                            | *"configura docker"*, *"prepara el entorno"*, *"variables de entorno"*  |
| **backend-tester**    | QA & TDD Master               | `tdd-master`<br>`api-contract-tester`<br>`infra-security-tester` | *"infra red-check"*, *"test de contrato"*, *"ejecuta tests"*            |
| **backend-coder**     | Arquitecto de Lógica          | `feature-logic-builder`<br>`clean-architecture-expert`           | *"implementa lógica"*, *"crea endpoint"*, *"desarrolla caso de uso"*    |
| **backend-reviewer**  | Notario de Calidad Técnica    | `code-review-master`<br>`architecture-compliance`                | *"certifica la tarea"*, *"audita el código"*, *"review técnica"*        |
| **frontend-tester**   | Guardián UX & UI              | `frontend-tdd-master`<br>`e2e-test-automation`                   | *"front red-check"*, *"test de componentes"*, *"e2e test"*              |
| **frontend-coder**    | Arquitecto de Interfaz        | `frontend-logic-builder`<br>`ui-component-architect`             | *"implementa el front"*, *"crea el componente"*, *"estila la interfaz"* |
| **frontend-reviewer** | Notario de Calidad Visual     | `ui-code-review-master`<br>`frontend-doc-integrity`              | *"certifica el front"*, *"review de interfaz"*, *"audita la ui"*        |

---

## 🛠️ Herramientas y Habilidades (Skills)

Las habilidades son protocolos técnicos que los agentes invocan para ejecutar tareas complejas con precisión:

*   **[session-close-handoff](.claude/skills/session-close-handoff/SKILL.md)**: Persistencia del estado técnico y definición del "Next Step".
*   **[session-close-lessons](.claude/skills/session-close-lessons/SKILL.md)**: Extracción de aprendizaje y registro de fricciones técnicas.
*   **[stage-audit](.claude/skills/stage-audit/SKILL.md)**: Certificación de veracidad entre tareas y código real.
*   **[stage-close](.claude/skills/stage-close/SKILL.md)**: Traducción de hitos técnicos a valor de negocio (Resumen Ejecutivo).
*   **[docker-lifecycle](.claude/skills/docker-lifecycle/SKILL.md)**: Estándar de contenedores, cuotas de RAM y resiliencia.
*   **[secrets-guard](.claude/skills/secrets-guard/SKILL.md)**: Gestión segura de variables de entorno y protección de datos.
*   **[service-validator](.claude/skills/service-validator/SKILL.md)**: Validación de disponibilidad y salud de servicios nucleares.
*   **[tdd-master](.claude/skills/tdd-master/SKILL.md)**: Protocolo RED-GREEN-REFACTOR y validación de calidad.
*   **[api-contract-tester](.claude/skills/api-contract-tester/SKILL.md)**: Validación de esquemas, JSON y formatos contractuales.
*   **[infra-security-tester](.claude/skills/infra-security-tester/SKILL.md)**: Auditoría de seguridad de infraestructura y hardening.
*   **[feature-logic-builder](.claude/skills/feature-logic-builder/SKILL.md)**: Implementación de flujos de negocio y endpoints basados en contratos.
*   **[persistence-architecture](.claude/skills/persistence-architecture/SKILL.md)**: Gestión desacoplada de la capa de datos.
*   **[clean-architecture-expert](.claude/skills/clean-architecture-expert/SKILL.md)**: Aplicación de principios SOLID y deuda técnica cero.
*   **[code-review-master](.claude/skills/code-review-master/SKILL.md)**: Auditoría de legibilidad, patrones y Clean Code.
*   **[architecture-compliance](.claude/skills/architecture-compliance/SKILL.md)**: Validación de la topología de capas y dependencias.
*   **[doc-integrity-audit](.claude/skills/doc-integrity-audit/SKILL.md)**: Sincronización entre código, Specs y documentación de gobernanza.
*   **[frontend-tdd-master](.claude/skills/frontend-tdd-master/SKILL.md)**: Protocolo RED-GREEN para componentes e interacciones de UI.
*   **[e2e-test-automation](.claude/skills/e2e-test-automation/SKILL.md)**: Automatización de flujos completos del usuario.
*   **[ux-visual-validator](.claude/skills/ux-visual-validator/SKILL.md)**: Auditoría de consistencia visual, accesibilidad y responsividad.
*   **[frontend-logic-builder](.claude/skills/frontend-logic-builder/SKILL.md)**: Implementación de lógica de interfaz y comunicación con la API.
*   **[ui-component-architect](.claude/skills/ui-component-architect/SKILL.md)**: Maquetación atómica, estilos y layouts responsivos.
*   **[state-flow-manager](.claude/skills/state-flow-manager/SKILL.md)**: Gestión de estados globales, mutaciones y caché de datos.
*   **[ui-code-review-master](.claude/skills/ui-code-review-master/SKILL.md)**: Auditoría de legibilidad en componentes y eficiencia de renderizado.
*   **[visual-consistency-reviewer](.claude/skills/visual-consistency-reviewer/SKILL.md)**: Certificación de fidelidad al diseño y tokens de estilo.
*   **[frontend-doc-integrity](.claude/skills/frontend-doc-integrity/SKILL.md)**: Sincronización entre la UI real y la Spec técnica.

---

## 🛤️ Flujos de Trabajo (Workflows)

Protocolos de operación paso a paso accesibles para cualquier agente o usuario:

*   **[/change-control](.agents/workflows/change-control.md)**: Gestión del ciclo de vida de cambios estructurales (CREATE/APPROVE/REJECT).
*   **[/git-push](.agents/workflows/git-push.md)**: Subida segura a GitHub respetando la higiene de ramas y PRs.

---

## ⚖️ Reglas de Operación (Rules)

Configuración global que rige el comportamiento de todos los agentes:

*   **[global.md](.agents/rules/global.md)**: Contexto de interoperabilidad híbrida y soberanía del SDD.

---

> **Nota para los Agentes:** Siempre revisar el archivo `.md` individual del agente en la carpeta `.claude/agents/` para adoptar plenamente el rol y las restricciones antes de ejecutar una tarea.
