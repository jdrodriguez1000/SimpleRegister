---
name: state-flow-manager
description: Gestión de estados globales, mutaciones y caché de datos. Asegura que el flujo de información en la interfaz sea predecible, eficiente y sincronizado.
user-invocable: false
agent: frontend-coder
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🌊 I. Unidireccionalidad y Verdad Única (SSOT)

El programador debe asegurar que la información fluya de forma predecible:

1. **Local vs Global:** Mantener el estado lo más cerca posible de donde se usa. Solo elevar a "Estado Global" lo que realmente debe compartirse (ej: Datos del Usuario, Registros de la Sesión).
2. **Predictibilidad:** Usar patrones de actualización claros (ej: Actions/Dispatches o Mutaciones controladas). El estado nunca debe mutarse directamente de forma "mágica".
3. **Persistencia Ligera:** Decidir qué partes del estado deben sobrevivir a una recarga de página (ej: LocalStorage o SessionStorage) según la Spec.

## 💾 II. Gestión de Caché y Datos de Servidor

- **Optimistic Updates:** Siempre que sea posible, actualizar la UI inmediatamente mientras la API responde en segundo plano para dar una sensación de fluidez extrema al usuario.
- **Auto-Invalidación:** Asegurar que si los datos cambian (ej: se añade un nuevo registro), la lista guardada en caché se invalide y se vuelva a pedir al servidor automáticamente.
- **Handling Slow Connections:** Implementar reintentos y lógica de "re-sincronización" cuando el usuario recupera la conexión a internet.

## ⚡ III. Rendimiento y Mutaciones

1. **Rendimiento de Renderizado:** Evitar que un cambio en una pequeña parte del estado provoque que toda la aplicación se vuelva a renderizar. Usar selectores inteligentes o memorización.
2. **Estado de Transición:** Manejar explícitamente los estados de transición (ej: `isSaving`, `isDeleting`) para bloquear acciones duplicadas y dar feedback visual.
3. **Limpieza de Caché:** Garantizar que los datos sensibles (ej: registros borrados) desaparezcan del estado global inmediatamente tras la confirmación exitosa de la API.

---

> **Check de Certificación:**
> - [ ] ¿El flujo de datos es fácil de rastrear desde que ocurre la acción hasta que se actualiza la UI?
> - [ ] ¿He implementado Caché para evitar peticiones innecesarias a la API?
> - [ ] ¿La aplicación se siente fluida y reactiva incluso con latencia de red?
