---
name: ui-component-architect
description: Maquetación atómica, estilos y layouts responsivos. Asegura que los componentes visuales de la interfaz sean modulares, reutilizables y estéticamente coherentes.
user-invocable: false
agent: frontend-coder
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🏗️ I. El Diseño Atómico (Atomic Design)

El arquitecto debe clasificar cada pieza de la UI para garantizar su reusabilidad:

1. **Atoms (Átomos):** Los componentes más simples (ej: botones, inputs, etiquetas). No deben tener lógica de negocio pesada, solo props de estilo y eventos simples.
2. **Molecules (Moléculas):** Uniones de átomos que forman una unidad funcional (ej: un campo de búsqueda con botón).
3. **Organisms (Organismos):** Secciones complejas de la página (ej: Header, Formulario de Registro). Son los que orquestan la lógica de negocio capturada por la habilidad `frontend-logic-builder`.
4. **Layouts & Templates:** Definición de la estructura global (Grid, Flexbox) que envuelve a los organismos.

## 🎨 II. Implementación de Estilos y Consistencia

- **Variables de Diseño:** Priorizar el uso de tokens de diseño (variables CSS para colores, fuentes y espacios) para que el cambio global de estilo sea instantáneo.
- **Resiliencia Visual:** Asegurar que los componentes no se rompan si el contenido es demasiado largo (ej: nombres muy largos o textos multilingües).
- **Responsividad Nativa:** Implementar estrategias "Mobile-First" usando Media Queries o técnicas de Flexbox/Grid que se adapten sin necesidad de intervención manual constante.

## 📐 III. Separación Visual/Lógica (Design Isolation)

1. **Presentational Components:** Aquellos que solo "pintan" los datos recibidos por props. Su única responsabilidad es lucir bien.
2. **Container Components:** Los que gestionan la obtención de datos y se los pasan a los presentacionales.
3. **Pure CSS/Styles:** Evitar los estilos en línea (inline styles). Todo debe estar encapsulado en archivos de estilo o sistemas de CSS-in-JS que eviten fugas de cascada inesperadas.

---

> **Check de Certificación:**
> - [ ] ¿El componente es reutilizable y no tiene lógica de negocio hardcoded?
> - [ ] ¿He verificado que los estilos se adaptan a móviles y escritorio?
> - [ ] ¿Uso las variables de color y tipografía globales del proyecto?
