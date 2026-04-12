---
name: plan_document
description: Protocolo para la estructuración temporal y gestión de hitos para la generación del documento `PROJECT_plan.md`. Este protocolo transforma los requerimientos y la arquitectura en una hoja de ruta lógica, dividida en bloques ejecutables que permiten la medición del progreso real y la gestión de expectativas del cliente.

---

## 🔍 I. Sincronización de Objetivos (Target Mapping)
El protocolo vincula directamente el plan con los documentos de gobernanza previos:
1.  **Mapeo de Targets:** Cada iteración debe declarar explícitamente qué códigos de **RF** (Funcionales) o **RNF** (No Funcionales) del `PROJECT_scope.md` está atacando.
2.  **Validación de Arquitectura:** Asegurar que los entregables de la iteración son coherentes con los patrones definidos en `PROJECT_architecture.md`.
3.  **Estado de Tokens:** Requiere `scope_token.md` y `arch_token.md` en estado `AUTORIZADO (🟢)`.

---

## ⚖️ II. Lógica de Incremento Real (Value-Driven Logic)
El protocolo aplica la mentalidad de **Abogado del Diablo** para evitar iteraciones de "solo código":
- **Regla del Entregable Tangible:** Una iteración no termina con "progreso", termina con un artefacto probado (un entorno, una API, un módulo UI, una configuración de seguridad).
- **Priorización RNF-First:** El protocolo sugiere priorizar los RNF críticos (Performance, Seguridad) en las primeras iteraciones para reducir el riesgo técnico temprano.
- **Cierre de Ciclo:** Cada iteración debe pasar por el flujo: Spec -> TDD -> Validación -> Demo.

---

## 📑 III. Estructuración de Salida (Standard Output)
El protocolo generará el documento `docs/governance/PROJECT_plan.md` con el siguiente formato por cada iteración:

### ### Iteración [N]: [Nombre de la Misión]
* **Target:** Lista de identificadores de requerimientos (ej: **RNF1**, **RF2**).
* **Misión:** Breve descripción del objetivo técnico de este ciclo.
* **Entregables Principales:**
    * [Artefacto Técnico 1] (ej: Repositorio configurado con CI/CD).
    * [Artefacto Técnico 2] (ej: Endpoint de Auth validado con 100% cobertura).
    * [Artefacto Técnico 3] (ej: Smoke tests de latencia aprobados).

---

## 🔏 IV. Restricciones de Soberanía y Rutas (Storage Guard)
1.  **Ruta del Documento:** `docs/governance/PROJECT_plan.md`
2.  **Ruta del Token:** `audits/governance/plan_token.md`
3.  **Soberanía:** Solo se modifica tras la instrucción: "Generar iteraciones" o "Actualizar plan de trabajo".
4.  **Efecto Cascada:** Si un RNF cambia en el alcance, el "Target" de la iteración afectada debe ser re-evaluado.

---

## ✅ V. Auditoría de Cierre (Iterative Final Check)
- [ ] ¿Están todos los RF y RNF distribuidos en la suma de las iteraciones?
- [ ] ¿Cada iteración tiene entregables que se pueden probar de forma independiente?
- [ ] ¿La primera iteración establece los cimientos técnicos (Performance/Stack)?
- [ ] ¿El orden de las iteraciones mitiga los riesgos más grandes primero?