---
name: task-document
description: Protocolo de descomposición operativa para la generación del documento `PROJECT_backlog.md`. Este protocolo transforma las definiciones del contrato técnico (`PROJECT_spec.md`) en unidades mínimas de trabajo (Tareas Atómicas), garantizando una trazabilidad total y una asignación de responsabilidades inequívoca.
---

## 🏗️ I. Lógica de Ciclo de Vida por Agentes (Agile TDD Flow)

Para cada requerimiento técnico o endpoint extraído de la `PROJECT_spec.md`, el protocolo desglosará la actividad en cinco tareas atómicas e interdependientes:

1.  **RED [TSK-R]:** Diseño y creación de la suite de pruebas (Unit/Integration) que definen el éxito del requerimiento.
    * **Agente:** `tester`
    * **Objetivo:** Establecer el fallo controlado (Estado RED).

2.  **GREEN [TSK-G]:** Implementación del código mínimo necesario para satisfacer los tests.
    * **Agente:** `coder`
    * **Objetivo:** Pasar a estado VERDE rápidamente.

3.  **REFACTOR [TSK-RF]:** Limpieza de código, optimización y alineación con patrones arquitectónicos sin alterar el comportamiento.
    * **Agente:** `coder`
    * **Objetivo:** Eliminar deuda técnica inmediata y asegurar código premium.

4.  **VALIDATION [TSK-V]:** Ejecución de la suite completa de pruebas en el entorno de integración y reporte de cobertura.
    * **Agente:** `tester`
    * **Objetivo:** Validar que la implementación es robusta y no rompe regresiones.

5.  **CERTIFICATION [TSK-C]:** Auditoría de cumplimiento del contrato técnico.
    * **Agente:** `reviewer`
    * **Objetivo:** Garantizar que el resultado final coincide al 100% con lo dictado en la `PROJECT_spec.md`.


## 🗺️ II. Visualización de la Cadena de Confianza (Mermaid)

El flujo de transferencia de responsabilidades se visualiza de la siguiente manera:

```mermaid
graph LR
    RED[RED: Test Suite] -- Falla --> GREEN[GREEN: Min Impl]
    GREEN -- Código --> RF[RF: Refactor]
    RF -- Clean Code --> VAL[VAL: Ejecución Tests]
    VAL -- Éxito --> CERT[CERT: Spec Review]
    CERT -- Done --> NEXT[Siguiente Componente]

    style RED fill:#f96,stroke:#333,stroke-width:2px
    style GREEN fill:#9f9,stroke:#333,stroke-width:2px
    style RF fill:#ddd,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
    style VAL fill:#9cf,stroke:#333,stroke-width:2px
    style CERT fill:#f9f,stroke:#333,stroke-width:2px
```


## 📑 III. Estructuración de Salida (Standard Output)
El documento en `docs/governance/PROJECT_backlog.md` debe seguir este formato estricto:

### # Lista de Tareas — [Nombre de la Iteración] ([ID_Iteración])
> **Trazabilidad:** Implementa `docs/governance/PROJECT_plan.md` [Versión].
> **Filosofía:** TDD Riguroso y Cadena de Confianza (Coder → Tester → Reviewer).
> **Regla de Operación:** 1 Tarea = 1 Agente.

### ## Mapa de Dependencias
[Bloque de código Mermaid]

### ## Bloque [N] — [Nombre del Módulo] [Etapa X.X.X]
- [ ] `[TSK-ID-01]` [Nombre Atómico de la Tarea]
    - **Agente responsable**: [backend-coder | frontend-coder | devops-integrator | qa-tester]
    - **DoD**: [Criterios técnicos objetivos y verificables]


## 🔏 IV. Restricciones de Soberanía y Rutas (Storage Guard)
1.  **Ruta del Documento:** `docs/governance/PROJECT_backlog.md`
2.  **Ruta del Token:** `audits/governance/backlog_token.md`
3.  **Dependencia de Spec:** El protocolo solo genera tareas de un bloque si la sección correspondiente en `PROJECT_spec.md` está en estado `AUTORIZADO`.
4.  **Soberanía:** Requiere la instrucción: "Generar backlog para la Iteración [N] con flujo de certificación".


## ✅ V. Auditoría de Calidad (Execution Final Check)
- [ ] ¿El flujo RED-GREEN-RF-VAL-CERT está explícito para cada componente lógico?
- [ ] ¿El diagrama Mermaid refleja fielmente la ruta crítica de 5 etapas?
- [ ] ¿El paso REFACTOR [TSK-RF] tiene un DoD que asegure la limpieza arquitectónica?
- [ ] ¿Los responsables (Agentes) están asignados según su perfil?
- [ ] ¿El DoD de la tarea CERT incluye la validación de la PROJECT_spec?