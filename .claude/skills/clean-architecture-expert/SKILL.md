---
name: clean-architecture-expert
description: Aplicación de principios SOLID y Clean Code para evitar deuda técnica. Asegura que el código sea modular, testeable y evolucione sin romper el sistema existente.
user-invocable: false
agent: backend-coder
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🏛️ I. Estructura de Capas (The Clean Way)

El experto debe organizar el código en cebolla (Onion Architecture), donde las dependencias siempre apuntan hacia adentro:

1. **Entities (Centro):** Reglas de negocio críticas que no cambian (ej: Concepto de 'Registro').
2. **Use Cases (Casos de Uso):** Lógica específica de la aplicación (ej: 'Crear Registro').
3. **Interface Adapters:** Controladores de API y Repositorios.
4. **Frameworks & Drivers (Exterior):** Web Framework, Base de Datos, Herramientas de Log.

## 🧱 II. El Credo de los 5 Mandamientos (SOLID)

Toda implementación del coder debe ser auditable bajo estos principios:

- **S (Single Responsibility):** Cada módulo o función hace una sola cosa y la hace bien.
- **O (Open/Closed):** El código está abierto a la extensión (nuevos servicios) pero cerrado a la modificación (no alterar el corazón de la lógica existente).
- **L (Liskov Substitution):** Cualquier implementación de una interfaz debe ser intercambiable sin romper el sistema.
- **I (Interface Segregation):** No obligar a un módulo a depender de métodos que no usa.
- **D (Dependency Inversion):** La lógica de negocio no debe depender de bibliotecas externas; las bibliotecas deben adaptarse a las interfaces del negocio.

## ✅ III. Protocolo de Revisión de Código (Self-Audit)

Antes de entregar una tarea (`green task`), el coder debe certificar:

1. **DRY (Don't Repeat Yourself):** No existe lógica duplicada en diferentes archivos.
2. **KISS (Keep It Simple, Stupid):** La solución implementada es la más sencilla que resuelve el problema.
3. **YAGNI (You Ain't Gonna Need It):** No se han programado funcionalidades extra "por si acaso" en el futuro.
4. **Clean Naming:** Las variables y funciones tienen nombres descriptivos (ej: `calculateHealthScore` en lugar de `f1`).

---

> **Check de Certificación:**
> - [ ] ¿Las flechas de dependencia apuntan siempre hacia el Dominio (centro)?
> - [ ] ¿He aplicado inyección de dependencias para facilitar el testing?
> - [ ] ¿El código es legible sin necesidad de comentarios excesivos?
