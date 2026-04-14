---
name: session-close-handoff
description: Protocolo técnico de consolidación de contexto y persistencia de estado mediante docs/governance/PROJECT_handoff.md para garantizar la continuidad del desarrollo.
user-invocable: false
agent: session-closer
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# Skill: session-close-handoff (Protocolo de Handoff Técnico y Persistencia)

Este protocolo define los estándares obligatorios para capturar, estructurar y persistir el estado exacto de un proyecto de software antes de finalizar una sesión de trabajo. Su objetivo fundamental es garantizar que cualquier relevo técnico (humano o agente) pueda retomar la ejecución con **Cero Pérdida de Contexto**.

## 🛡️ Consolidación de Estado (Checkpoint de Ingeniería)
Antes de dar por concluida la sesión, se debe reconstruir y documentar el mapa táctico del proyecto en el archivo central de persistencia `docs/governance/PROJECT_handoff.md`:

1.  **Identificación de Coordenadas de Proyecto**:
    -   **Ubicación en el Roadmap**: Extraer la Fase y Etapa activa desde el plan maestro de ejecución (`PROJECT_plan.md`).
    -   **Capas de Arquitectura Impactadas**: Mapear los dominios técnicos (Frontend, Backend, DB, Infra) afectados por los cambios realizados en la sesión actual.

2.  **Análisis del Conjunto de Trabajo (Working Set)**:
    -   **Inventario de Archivos**: Listar de forma precisa los archivos creados, modificados o eliminados sustancialmente.
    -   **Bloqueadores Críticos (Blockers)**: Documentar cualquier error técnico no resuelto, impedimento externo o desafío arquitectónico que deba abordarse prioritariamente al inicio de la siguiente jornada.

3.  **Definición del Próximo Paso (Next Step) Atómico**:
    -   **Accionabilidad Quirúrgica**: Formular la próxima acción inmediata con absoluta precisión. Debe ser una tarea clara, autocontenida y lista para ser ejecutada sin necesidad de re-analizar el historial completo de la conversación previa.

## 📝 Estructura Obligatoria del Documento de Handoff
El archivo `docs/governance/PROJECT_handoff.md` debe organizarse estrictamente en las siguientes secciones funcionales:

-   **§1 Coordenadas de Ejecución**: Ubicación actual en el ciclo de vida del proyecto y capas técnicas activas.
-   **§2 Hitos y Avance de Etapa**: Estado visual del progreso y descripción de los hitos alcanzados durante la sesión.
-   **§3 Inventario Técnico de Cambios**: Lista detallada de archivos, componentes y configuraciones actualizadas.
-   **§4 Mapa Táctico de Continuidad**: Detalle del "Working Set" actual, identificación de bloqueadores y definición del "Next Step" prioritario.
-   **§5 Registro Histórico de Decisiones (Append-only)**: Sección **inviolable** donde se registran cronológicamente las notas técnicas, decisiones de diseño y cambios de rumbo arquitectónico, preservando íntegramente el historial anterior.

## 📊 Veredicto de Persistencia y Calidad
Al finalizar el proceso, se debe emitir un estado de la persistencia:

- **ESTADO_PERSISTIDO_OK**: El handoff refleja fielmente la realidad técnica del repositorio y el próximo paso definido es 100% accionable.
- **CONTEXTO_INCOMPLETO (ERROR)**: Identificación de falta de información crítica sobre bloqueadores, desincronización con el plan maestro o alteración de la integridad del histórico de decisiones.

## 🛡️ Invariantes de Continuidad (Reglas de Oro)
-   **Integridad de la Memoria**: Nunca sobrescribir, truncar o eliminar información de la sección de decisiones históricas (§5). Es el rastro evolutivo del proyecto.
-   **Especificidad Extrema**: Queda prohibido el uso de pasos genéricos o ambiguos. Toda instrucción de continuidad debe ser técnica y específica (ej. "Implementar validación X en el modelo Y").
-   **Alineación con Auditoría**: El estado del handoff debe ser consistente con los registros de auditoría y tokens de conformidad técnica existentes en el repositorio.
