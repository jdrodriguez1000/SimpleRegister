---
name: visual-consistency-reviewer
description: Certificación de fidelidad al diseño y tokens de estilo. Asegura que la interfaz respeta el 100% de la identidad visual del proyecto.
user-invocable: false
agent: frontend-reviewer
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🎨 I. El Canon de Diseño

El revisor debe certificar la coherencia visual con el sistema de diseño:

1. **Tokens de Diseño:** ¿Se están usando las variables de color, espaciado y fuentes globales (`index.css` o equivalente)? Si un color está hardcoded (ej: `#fff` en lugar de `--color-white`), la tarea debe rechazarse.
2. **Hierarchy & Balance:** ¿La jerarquía visual (contrastes, tamaños de fuente) guía al usuario correctamente?
3. **Responsive Consistency:** ¿Se han verificado los puntos de quiebre (breakpoints)? ¿Se ve igual de bien en 320px que en 1440px?

## 📐 II. Micro-interacciones y Feedback

- **Transitions & Transforms:** ¿Las animaciones son suaves y mejoran la UX, o son bruscas y distraen?
- **User Feedback:** ¿Cada acción del usuario (clic, hover, error) tiene una respuesta visual inequívoca y coherente con el resto del sistema?

## ♿ III. Auditoría de Accesibilidad (Review)

- **Contrast:** Certificar que el contraste entre texto y fondo cumple con la normativa AA/AAA.
- **Focus States:** ¿Es visible el indicador de foco cuando se navega por teclado?
- **ARIA & Labels:** ¿Los elementos interactivos tienen etiquetas descriptivas para lectores de pantalla?

---

> **Check de Certificación:**
> - [ ] ¿Se han usado variables globales de estilo para colores y fuentes?
> - [ ] ¿He navegado el flujo completo con teclado y se ve el foco en cada botón?
> - [ ] ¿He verificado que el diseño no se rompe en pantallas pequeñas?
