---
name: session-close-lessons
description: Protocolo técnico de extracción de conocimiento, registro de fricciones y actualización histórica de lecciones aprendidas para optimizar el desarrollo futuro.
user-invocable: false
agent: session-closer
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# Skill: session-close-lessons (Protocolo de Post-Mortem y Capitalización)

Este protocolo define el procedimiento sistemático para transformar la experiencia operativa de cada sesión en activos de conocimiento técnico. Su objetivo es identificar patrones de éxito y fallas críticas para optimizar la evolución del sistema y evitar la reincidencia de errores arquitectónicos u operativos.

## 🧠 Destilación de Conocimiento (Retrospectiva Técnica)
Al finalizar cada sesión de trabajo, hito o etapa, se debe realizar una destilación de conocimiento en el registro oficial `docs/governance/PROJECT_lessons.md`:

1.  **Identificación de Éxitos Repetibles**:
    -   Documentar decisiones técnicas, patrones de diseño o flujos de trabajo que resultaron altamente eficientes y que deberían ser estandarizados en el futuro.

2.  **Registro de Fricciones y Fallos (Preventivo)**:
    -   Detallar errores cometidos, bloqueadores técnicos, callejones sin salida o decisiones que debieron ser revertidas. El valor reside en documentar la causa raíz para prevenir su repetición en fases posteriores.

3.  **Pivotes y Adaptaciones de Diseño**:
    -   Registrar cambios significativos en el diseño original (PRD/SPEC) y la justificación técnica detrás de cada adaptación, manteniendo la trazabilidad de la evolución del producto.

## 📝 Estructura del Registro de Lecciones Aprendidas
El archivo `docs/governance/PROJECT_lessons.md` actúa como el diario histórico de ingeniería del proyecto y debe actualizarse con el siguiente formato estructurado:

### Sesión: [YYYY-MM-DD] (Fase [F]. Etapa [E])
-   ✅ **Éxitos y Aciertos Técnicos**: [Descripción concisa del hito alcanzado o patrón exitoso].
-   ⚠️ **Fricciones y Desafíos**: [Descripción del problema, error o bloqueador y cómo se resolvió].
-   💡 **Lección Clave y Recomendación**: [Conclusión técnica de alto valor para aplicaciones futuras].

## 📊 Veredicto de Capitalización Operativa
Al concluir la actualización del registro, se debe emitir un estado de la capitalización:

- **APRENDIZAJE_REGISTRADO_OK**: Los conocimientos críticos de la sesión han sido destilados, documentados y el histórico ha sido actualizado satisfactoriamente.
- **SESIÓN_SIN_REPETICIÓN (ERROR)**: Identificación de falta de registro de fricciones o éxitos, resultando en una pérdida de valor operativo y memoria técnica del proyecto.

## 🛡️ Invariantes de Capitalización (Reglas de Oro)
-   **Cultura de Honestidad Técnica**: El éxito del protocolo depende de documentar lo que falló con la misma rigurosidad que lo que funcionó. No se omiten errores.
-   **Prohibición de Sobreescritura**: Se prohíbe eliminar, truncar o modificar registros de sesiones o etapas anteriores. El archivo debe ser un flujo continuo y expansivo de aprendizaje.
-   **Contextualización**: Cada lección debe estar vinculada a la Fase y Etapa en la que se originó, permitiendo un análisis histórico del crecimiento del sistema.
