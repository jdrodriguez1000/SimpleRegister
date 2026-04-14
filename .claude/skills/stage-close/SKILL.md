---
name: stage-close
description: Protocolo técnico de cierre ejecutivo y entrega formal de etapa. Genera el Resumen Ejecutivo (Executive Summary) en lenguaje de negocio.
user-invocable: false
agent: stage-closer
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# Skill: stage-close (Protocolo de Cierre Ejecutivo y Reporte de Etapa)

Este protocolo define el procedimiento formal para concluir una etapa operativa del ciclo de vida del software, traduciendo los hitos técnicos alcanzados en valor de negocio tangible para los stakeholders y asegurando la persistencia histórica del progreso del proyecto.

## 📈 Traducción de Valor (Tech-to-Business)
El cierre formal de etapa exige la transformación de métricas de ingeniería en indicadores estratégicos comprensibles para la toma de decisiones:

1.  **Hitos y Logros Alcanzados**: Convertir desarrollos técnicos (ej. endpoints, esquemas de DB, componentes UI) en funcionalidades operativas de negocio (ej. "Módulo de Seguridad Blindado", "Motor de Procesamiento en Tiempo Real").
2.  **Impacto Directo en el Producto**: Documentar cómo las entregas de esta etapa mejoran la estabilidad, escalabilidad, seguridad o la experiencia del usuario final de la aplicación.
3.  **Cálculo de Progreso Real del Proyecto**:
    -   **Roadmap Maestro**: Consultar el plan maestro de ejecución (`PROJECT_plan.md`) y las tablas de seguimiento de hitos.
    -   **Avance Porcentual**: Determinar con precisión el porcentaje de avance global del proyecto tras la finalización certificada de la etapa actual.

## 📝 Elaboración del Resumen Ejecutivo (Executive Summary)
Como resultado del cierre, se debe actualizar el documento maestro de cierre ejecutivo en `docs/governance/PROJECT_executive.md`. Este documento actúa como una bitácora acumulativa que preserva la historia de todas las iteraciones.

La estructura para cada nueva iteración añadida debe ser:

### 🏁 Iteración [X]: [Nombre de la Iteración]
-   **§1 Resumen de Logros Estratégicos**: Lista de los hitos de mayor impacto para el negocio alcanzados.
-   **§2 Estado de Cumplimiento de Requerimientos**: Análisis del porcentaje de éxito sobre los requerimientos funcionales y técnicos definidos.
-   **§3 Gestión de Riesgos y Desafíos Residuales**: Resumen de bloqueadores, soluciones aplicadas y riesgos futuros.
-   **§4 Indicadores de Progreso Relativo**: Porcentaje de avance de la Fase activa y del Proyecto Total.

> [!IMPORTANT]
> Si el archivo `PROJECT_executive.md` no existe, debe crearse con un encabezado principal antes de añadir la primera iteración. Si existe, la nueva iteración debe añadirse al final preservando las anteriores.

## ⛓️ Validación de Precedencia (Gate de Auditoría)
El protocolo de cierre ejecutivo solo puede activarse si se cumple la condición de integridad técnica previa:

-   **Visado de Auditoría de Etapa**: Debe existir el reporte de auditoría técnica satisfactorio en el registro oficial (`audits/pipeline/stage/`) con estado de conformidad.
-   **Bloqueo por Falta de Auditoría**: Queda estrictamente prohibido generar reportes ejecutivos o declarar el cierre de una etapa ante el negocio si esta no ha sido auditada y certificada técnicamente de forma previa.

## 📊 Veredicto de Finalización Formal
Al concluir el reporte, se debe emitir un estado final de la etapa:

- **ETAPA_FINALIZADA_OK**: Resumen ejecutivo generado con éxito, progreso del roadmap actualizado y trazabilidad de negocio asegurada.
- **CIERRE_RECHAZADO (ERROR)**: Identificación de falta de visado técnico de auditoría o inconsistencia crítica en los indicadores de progreso reportados.

## 🛡️ Invariantes de Reporte (Reglas de Oro)
-   **Cero Jerga Tecnológica**: El destinatario es el responsable del negocio. El lenguaje debe ser profesional, directo y enfocado exclusivamente en resultados y valor aportado.
-   **Transparencia y Veracidad**: Si un requerimiento fue diferido o no alcanzó los estándares, debe quedar documentado con absoluta honestidad. No se permiten "maquillajes" de resultados técnicos.
-   **Fuente de Verdad Única (SSOT)**: Todos los datos de progreso y cumplimiento deben derivar exclusivamente del Plan Maestro y la documentación de gobernanza autorizada.
