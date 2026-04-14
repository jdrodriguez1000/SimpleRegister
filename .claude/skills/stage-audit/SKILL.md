---
name: stage-audit
description: Protocolo técnico de auditoría de etapa (Stage-Gate). Verifica trazabilidad entre requerimientos (PRD), tareas (TASK) y evidencias físicas en el repositorio.
user-invocable: false
agent: stage-auditor
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# Skill: stage-audit (Protocolo de Transición de Etapa y Quality Gates)

Este protocolo define los criterios técnicos y administrativos finales para el cierre de una etapa operativa en el ciclo de vida del desarrollo. Actúa como el **"Quality Gate" definitivo**, asegurando que el producto o funcionalidad construida cumple estrictamente con el plan maestro y los estándares de calidad del proyecto.

## 🛡️ Auditoría de Conformidad (Definition of Done - DoD)
Antes de certificar el cierre formal de una etapa, se debe realizar un "Cross-Check" exhaustivo entre la documentación de planificación y la realidad física del repositorio:

1.  **Verificación de Trazabilidad Integral (Requerimiento vs. Evidencia)**:
    -   **Nivel Estratégico**: Confirmar que cada requerimiento funcional o técnico definido en el **PRD** posee una especificación detallada en la **SPEC**.
    -   **Nivel Táctico**: Validar que cada tarea marcada como completada en la **TASK LIST** posee un reflejo funcional, comprobable y persistente en el código fuente o en los entregables técnicos.

2.  **Detección de "Código Fantasma" (Ghost Code)**:
    -   **Identificación de Desvíos**: Analizar el repositorio en busca de archivos, configuraciones o funcionalidades que no posean una tarea de respaldo en la planificación oficial o una mención en el diseño de arquitectura.
    -   **Regularización Obligatoria**: Cualquier "Ghost Code" debe ser eliminado o regularizado mediante un proceso de control de cambios antes de autorizar el cierre de la etapa.

## ⛓️ Validación de la Cadena de Confianza (Domain Tokens)
Para validar el éxito de una etapa técnica, el protocolo exige la vigencia y aprobación de todos los visados previos en el registro de auditoría (`audits/pipeline/`):

-   **Backend/Frontend Quality**: Revisión de código y calidad técnica por especialistas asignados (Tokens de Reviewer).
-   **Security & Hardening**: Certificación de invulnerabilidad y protección de datos (Tokens de Seguridad/Hardener).
-   **Integration & E2E**: Validación de flujos de usuario completos y comunicación entre servicios (Tokens de Integración E2E).
-   **Compliance & Privacy**: Cumplimiento normativo y ética de datos (Tokens de Privacidad/GDPR).

## 📊 Veredicto de Cierre de Etapa
Como autoridad final de cumplimiento, se debe emitir un veredicto vinculante:

- **CONFORME (ETAPA_CERTIFICADA)**: El 100% de los entregables coinciden con el plan, los tokens de dominio son válidos y no se detectan desvíos no documentados.
- **BLOQUEADO (INCUMPILIMIENTOS)**: Identificación de brechas entre la planificación y la ejecución, ausencia de evidencias físicas o falta de visados técnicos previos.

## 🛡️ Invariantes del Auditor (Reglas de Oro)
-   **Prioridad de la Evidencia Física**: Sin la existencia de un archivo o entregable físico real, la tarea no se audita como completada. El estado de un checkbox no sustituye a la evidencia técnica.
-   **Integridad del Ecosistema Documental**: Reportar proactivamente cualquier discrepancia, desactualización o falta de coherencia entre los documentos de gobernanza (PRD, SPEC, PLAN, TASK).
-   **Token de Autorización Final**: El reporte de auditoría de etapa es el único documento que habilita formalmente el inicio de la planificación para el siguiente hito en el roadmap del proyecto.
