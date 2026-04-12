---
name: architecture-document
description: Protocolo para el diseño técnico y validación estructural para la generación del documento `PROJECT_architecture.md`. Este protocolo garantiza que las decisiones tecnológicas (Stack), organizacionales (Patrones) y de calidad (Testing) estén alineadas con el alcance funcional y las restricciones no funcionales (RNF) definidas en la fase de gobernanza previa.
---

## 🧱 0. Pre-requisito de Gobernanza (Hard Gate)
**BLOQUEO DE ENTRADA:** Este protocolo **tiene prohibido iniciar** si el archivo `audits/governance/scope_token.md` no presenta el estatus `AUTORIZADO (🟢)`. 
- Si el alcance está bloqueado o ausente, el agente debe detenerse y notificar que no hay una base autorizada para el diseño técnico.

## 🔍 I. Alineación con el Alcance (Scope Sync)
Antes de proponer cualquier solución técnica, el protocolo ejecuta un análisis de dependencias:
1.  **Validación de RNF:** Lectura obligatoria de `docs/governance/PROJECT_scope.md` para identificar métricas de seguridad, latencia y concurrencia.
2.  **Análisis de Restricciones:** Identificación de limitaciones presupuestarias, de tiempo o de infraestructura (ej. "Solo AWS", "Presupuesto limitado para servidores").
3.  **Evaluación de Carga:** Contraste entre la arquitectura propuesta y el volumen de usuarios/datos esperado.

---

## 🧪 II. Lógica de Contradicción Técnica (Technical Devil's Advocate)
El protocolo somete cada decisión a una prueba de estrés lógico:
- **Regla de Simplicidad (KISS):** ¿Esta tecnología añade valor real o es "Hype-Driven Development"? ¿Se puede resolver de forma más simple?
- **Regla de Desacoplamiento:** Si el framework o la base de datos quedan obsoletos, ¿cuántas líneas de lógica de negocio habría que reescribir?
- **Regla de Costo Operativo:** ¿El equipo actual puede mantener esta infraestructura, o estamos creando un "cuello de botella" de conocimiento?

---

## 📑 III. Estructuración de Salida (Standard Output)
El protocolo generará obligatoriamente los siguientes bloques en `docs/governance/PROJECT_architecture.md`:

### 1. Stack Tecnológico (Justificación de Herramientas)
* **Lenguajes y Frameworks:** Selección basada en rendimiento y ecosistema.
* **Persistencia de Datos:** Elección de motor (SQL/NoSQL) y estrategia de modelado.
* **Infraestructura & Cloud:** Proveedores y servicios (Containers, Serverless, API Gateways).

### 2. Patrones de Diseño y Estructura
* **Arquitectura de Alto Nivel:** (Ej: Arquitectura Hexagonal, Clean Architecture, Microservicios).
* **Patrones de Código:** (Ej: Repository Pattern, Dependency Injection, Singleton).
* **Flujo de Datos:** Descripción técnica del ciclo de vida de una petición (Request -> Auth -> Logic -> DB).

### 3. Estrategia de Pruebas (Pirámide de Calidad)
* **Herramientas:** Frameworks de testing (Jest, PyTest, Cypress, etc.).
* **Pirámide de Pruebas:** Definición porcentual del esfuerzo (Unitarias, Integración, E2E).
* **Protocolo TDD:** Reglas para la ejecución de pruebas en el entorno de desarrollo y CI/CD.

### 4. Gobernanza de Arquitectura (`audits/governance/arch_token.md`)
Actualización del estatus del token de arquitectura.

### 5. Disparo de Interrogatorio (Pressure Test)
Preguntas de control técnico basadas en las debilidades detectadas (ej: "SPOF", "Cuellos de botella", "Deuda técnica asumida").

---

## 🔏 IV. Restricciones de Soberanía y Rutas (Storage Guard)
1.  **Ruta del Documento:** `docs/governance/PROJECT_architecture.md`
2.  **Ruta del Token:** `audits/governance/arch_token.md`
3.  **Soberanía de Datos:** No se modificará el archivo sin la instrucción explícita: "Actualizar arquitectura" o "Proceder con el diseño técnico".
4.  **Dependencia de Gobernanza:** El token de arquitectura permanecerá `BLOQUEADO` si el `scope_token.md` no está en estado `AUTORIZADO (🟢)`.

---

## ✅ V. Auditoría de Cierre (Technical Final Check)
- [ ] ¿El Stack cubre todos los Requerimientos No Funcionales?
- [ ] ¿La arquitectura permite el testeo independiente (Mocking) de la lógica de negocio?
- [ ] ¿Se ha definido una estrategia clara para el manejo de errores y logs?
- [ ] ¿La pirámide de pruebas es realista y cubre los flujos críticos definidos en el alcance?