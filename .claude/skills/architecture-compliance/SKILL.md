---
name: architecture-compliance
description: Validación de la topología de capas y dependencias. Asegura que el proyecto no degrade su estructura técnica con el paso del tiempo.
user-invocable: false
agent: backend-reviewer
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🏗️ I. Auditoría de Capas (Layer Isolation)

El revisor debe certificar que las flechas de dependencia siempre apuntan hacia el Dominio (el centro):

1. **Inversión de Dependencia:** ¿El Dominio está libre de importaciones de infraestructura (ej: No hay `import { SQL_DB }` en las entidades)? Si el dominio depende de la infraestructura, **RECHAZO DIRECTO**.
2. **Capa de Casos de Uso:** ¿Los orquestadores de lógica están aislados de la lógica de red (HTTP/gRPC/etc)? 
3. **Controladores y Adaptadores:** ¿Se están usando los adaptadores adecuados para transformar los datos externos en entidades de negocio?

## 📐 II. El Contrato de Interfaces

Asegurar que el código no use implementaciones concretas de forma innecesaria:

- **Programar para Interfaces:** ¿El código llama a `IRepository` o directamente a `PostgresRepository`? Se debe priorizar la interfaz para permitir el intercambio de componentes.
- **Acoplamiento Galopante:** ¿Un módulo sabe demasiado sobre otro? Intentar que la comunicación sea mediante DTOs (Data Transfer Objects) limpios.
- **Single Source of Truth:** ¿Existe lógica de negocio duplicada en la capa de controladores? La lógica debe estar centralizada en el Dominio.

## 📄 III. Reporte de Alineación Arquitectónica

Al final del review, el agente debe declarar si se ha violado la **`PROJECT_architecture.md`**:

- **Layer Check:** 🟢 OK (No hay fugas circulares).
- **Dependency Flow:** 🟢 OK (Fuera hacia Adentro).
- **Mockability:** 🟢 OK (El código es fácil de testear con dobles).

---

> **Check de Certificación:**
> - [ ] ¿He verificado que ninguna clase de Dominio importa bibliotecas de terceros pesadas?
> - [ ] ¿El flujo de datos sigue el patrón definido en la arquitectura?
> - [ ] ¿Se han respetado los límites de los módulos propuestos?
