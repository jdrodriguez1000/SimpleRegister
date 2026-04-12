---
name: frontend-logic-builder
description: Implementación de lógica de interfaz y comunicación con la API. Asegura que la gestión de datos, formularios y flujos de usuario en el cliente sean robustos y fieles a la Spec técnica.
user-invocable: false
agent: frontend-coder
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🛰️ I. Comunicación con la API (Data Fetching)

El programador debe centralizar el acceso a los datos externos:

1. **Servicios y Adaptadores:** No realizar llamadas a la API directamente desde los componentes. Usar "Servicios" o "Clientes de API" que abstraigan la lógica de red.
2. **Transformación de Respuesta:** Adaptar los datos del backend (ej: Snake_case) a los formatos internos del frontend (ej: CamelCase) si es necesario, asegurando que la Spec se cumpla 1:1.
3. **Manejo de Estados de Red:** Asegurar que los componentes reciban información sobre si el dato está "Cargando", "Listo" o ha ocurrido un "Error".

## 📝 II. Orquestación de Formularios (Form Logic)

1. **Validación Preventiva:** Implementar validaciones de cliente (ej: email válido, campos requeridos) antes de realizar peticiones al servidor.
2. **Sanitización:** Asegurar que los datos enviados al backend estén limpios y cumplan con los tipos requeridos (ej: Enviar `number` en lugar de `string` para latencias).
3. **Feedback Inmediato:** Proporcionar al usuario mensajes de éxito/error claros en cada interacción, según las reglas definidas en la Experiencia de Usuario (UX).

## ⚡ III. Lógica Asíncrona y Efectos

- **Control de Carreras:** Evitar condiciones de carrera (ej: si el usuario hace clic dos veces rápido en "Guardar", solo debe procesarse una petición o anular la anterior).
- **Clean Up:** Asegurar que las suscripciones a eventos o timers se limpien correctamente para evitar fugas de memoria (Memory Leaks).
- **Manejo de Errores Globales:** Implementar capturadores de error para fallos catastróficos (ej: API caída) para mostrar un fallback decente.

---

> **Check de Certificación:**
> - [ ] ¿He verificado que los datos enviados a la API coinciden exactamente con la `PROJECT_spec.md`?
> - [ ] ¿Los estados de carga (Loading) y error están implementados programáticamente?
> - [ ] ¿He centralizado la lógica de la API fuera del componente visual?
