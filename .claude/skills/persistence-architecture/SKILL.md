---
name: persistence-architecture
description: Gestión desacoplada de la capa de datos. Asegura que la lógica de negocio no dependa de un motor de DB específico mediante el uso de Repositorios e Interfaces.
user-invocable: false
agent: backend-coder
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🗄️ I. El Patrón Repositorio (Repository Pattern)

Toda interacción con la base de datos debe ocurrir a través de un Repositorio:

1. **Abstracción Total:** La lógica de negocio (Casos de Uso) solo llama a métodos como `.save(entity)` o `.findById(id)`. No sabe si detrás hay SQL, NoSQL o un simple archivo JSON.
2. **Entidades vs. Tablas:** Definir "Entidades de Dominio" que sean independientes de la estructura de la tabla de la base de datos. Usar mapping (traducción) si es necesario.
3. **Inyección de Dependencias:** El repositorio debe inyectarse en los servicios de negocio para permitir que el Tester use un "Mock de Datos" durante las pruebas de integración.

## 📐 II. Gestión de Esquemas y Migraciones

El programador debe proponer cambios en la estructura de datos siguiendo estos pasos:

- **Evolución Controlada:** Todo cambio en la estructura (añadir una columna, cambiar un tipo) debe realizarse mediante un archivo de migración con fecha y descripción.
- **Validación de Tipos:** Asegurar que los tipos de datos en la DB coincidan con los contratos de la `PROJECT_spec.md` (ej: UUID para IDs, Timestamp para fechas).
- **Índices de Rendimiento:** Definir índices para las consultas recurrentes mencionadas en la Spec (ej: Búsqueda por rango de fechas).

## 🧪 III. Atomicidad y Consistencia

1. **Transacciones:** Si una operación de negocio requiere modificar varios registros, usar transacciones para asegurar que se guarden todos o ninguno.
2. **Idempotencia:** Diseñar las funciones de guardado para que si se ejecutan dos veces con el mismo dato, el resultado final sea el mismo (evitar duplicados).
3. **Limpieza de Datos:** Nunca guardar campos que no estén en la Spec ("Campos Fantasma"). La Base de Datos debe ser el reflejo exacto de la Verdad Técnica.

---

> **Check de Certificación:**
> - [ ] ¿He separado la consulta SQL (o comando de DB) de la lógica de negocio?
> - [ ] ¿He creado una entidad de dominio que sea independiente del motor de DB?
> - [ ] ¿He validado que los nombres de los campos en la DB siguen el estándar del proyecto?
