---
name: tdd-master
description: Protocolo RED-GREEN-REFACTOR y validación de calidad. Regula el ciclo de vida de una tarea desde el fallo inicial hasta la certificación final.
user-invocable: false
agent: backend-tester
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🔄 I. El Ciclo de Vida de la Tarea (5 Pasos)

El tester debe guiar el desarrollo asegurando que se sigan estos pasos cronológicos:

1. **🚩 RED-CHECK (Fallo Controlado):**
   - Escribir un test que capture el requerimiento de la `PROJECT_spec.md`.
   - Ejecutar el test y **confirmar que falla**.
   - Si el test pasa sin código de implementación, el test está mal diseñado o el requerimiento ya existe.

2. **✅ GREEN-LIGHT (Funcionalidad Mínima):**
   - El Coder implementa la lógica mínima necesaria.
   - El Tester vuelve a ejecutar la suite.
   - El objetivo es que el test pase (Verde), sin importar la estética del código aún.

3. **🏗️ REFACTOR (Excelencia Técnica):**
   - Limpieza de código, eliminación de redundancias y aplicación de patrones.
   - El Tester asegura que tras la limpieza, los tests **siguen pasando**.

4. **🧪 VAL (Validación Cruzada):**
   - Ejecución de tests de integración para asegurar que el cambio no rompió otras partes del sistema.

5. **📜 CERT (Certificación Final):**
   - Generación del reporte de éxito y firma del "Definition of Done" (DoD) de la tarea.

## 📝 II. Estándar de Reporte (Test Results)

Al final de cada ejecución de prueba, el tester debe informar:
- **Total Tests:** X
- **Passed:** Y
- **Failed:** Z
- **Cobertura Sugerida:** Mínimo 80% en lógica de negocio crítica.

## 📏 III. Reglas de Validación de Contratos
- Se debe validar no solo que el dato exista, sino su **tipo y formato** (ej: Regex para UUIDs, ISO-8601 para fechas).
- Los errores (4xx, 5xx) deben ser testeados con la misma rigurosidad que los éxitos.

---

> **Check de Certificación:**
> - [ ] ¿He verificado que el test fallaba antes de la implementación?
> - [ ] ¿El test cubre el escenario de error (Edge Case)?
> - [ ] ¿Los nombres de los tests describen una conducta de negocio? (ej: "Debería fallar si el UUID es inválido").
