---
name: feature-logic-builder
description: Implementación de flujos de negocio y endpoints basados en contratos. Asegura que la lógica de dominio sea centralizada, testeable y fiel a la especificación técnica.
user-invocable: false
agent: backend-coder
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🏗️ I. El Dominio como Fuente de Verdad

El programador debe priorizar la lógica de negocio pura frente a los detalles del framework:

1. **Aislamiento de Lógica:** Las "Reglas de Negocio" (ej: Validar si un registro de salud es coherente) deben vivir en funciones puras o clases de "Caso de Uso".
2. **Sin Fugas de Infraestructura:** La lógica NO debe saber si los datos vienen de una API externa, de una base de datos o de un archivo. Debe basarse en interfaces o abstracciones de datos.
3. **Manejo de Errores de Negocio:** No lanzar errores genéricos. Usar excepciones con significado semántico (ej: `InconsistentLatencyError`, `ResourceNotFoundError`) que luego el controlador mapeará a códigos HTTP (400, 404).

## 📐 II. Implementación basada en SPEC

Antes de escribir código, el agente debe consultar la `PROJECT_spec.md`:

- **Contrato de Entrada:** Validar que todos los campos requeridos lleguen en el formato correcto antes de procesar la lógica.
- **Contrato de Salida:** Asegurar que el objeto de respuesta contenga exactamente lo que el cliente espera (formato de fecha, nombres de campo, etc.).
- **Transmisión de Estado:** Si una operación requiere varias etapas (ej: Escribir en Log y Actualizar Status), se debe garantizar que ambas ocurran o ninguna (Atomicidad lógica).

## 🚀 III. Proceso de Codificación (The Green Phase)

Siguiendo el flujo TDD que inició el Tester:

1. **Draft Initial:** Escribir la estructura básica de la función/endpoint para satisfacer la firma requerida.
2. **Domain Logic:** Implementar las validaciones y transformaciones de datos.
3. **Persistence Link:** Conectar con la capa de persistencia (usando la habilidad `persistence-architecture`) para guardar los cambios.
4. **Self-Check:** El coder debe realizar una revisión rápida de que no hay código "muerto" o logs innecesarios antes de entregar la tarea para validación.

---

> **Check de Certificación:**
> - [ ] ¿He validado las reglas del negocio antes de llamar a la base de datos?
> - [ ] ¿La respuesta del API es idéntica a la definida en el contrato?
> - [ ] ¿He manejado los escenarios de error (Caso Triste) de forma descriptiva?
