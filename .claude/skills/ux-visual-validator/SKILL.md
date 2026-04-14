---
name: ux-visual-validator
description: Auditoría de consistencia visual, accesibilidad y responsividad. Asegura que la interfaz sea estética, accesible (WCAG) y funcional en cualquier dispositivo.
user-invocable: false
agent: frontend-tester
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🎨 I. Consistencia Visual (Visual Audit)

El agente debe validar que la interfaz se siente coherente entre páginas:

1. **Color & Typography:** ¿Se están usando las variables de color y los tamaños de fuente definidos en el sistema de diseño? 
2. **Spacing Consistency:** ¿El espaciado (padding/margin) entre componentes es uniforme (ej: múltiplos de 4 u 8)?
3. **Micro-interacciones:** ¿Existen estados de hover inteligentes y transiciones suaves para mejorar la percepción de calidad?

## 💻 II. Responsividad (Multi-Device Logic)

Simular el comportamiento de la UI en diferentes resoluciones:
- **Mobile First:** Verificar que los formularios sean utilizables en móviles (botones grandes, inputs accesibles).
- **Desktop Layout:** Comprobar que en pantallas grandes el contenido no se "estire" demasiado y mantenga el equilibrio visual.
- **Breakpoints:** Auditar que no existan elementos que se "solapen" (overlap) en puntos de corte críticos.

## ♿ III. Accesibilidad (WCAG Awareness)

Certificar que el proyecto sea inclusivo:
- **Color Contrast:** Verificar que la relación de contraste entre texto y fondo cumpla con el estándar AA/AAA.
- **Keyboard Navigation:** ¿Es posible navegar todo el sistema usando únicamente la tecla TAB y ENTER?
- **Screen Reader Friendly:** ¿Los elementos tienen etiquetas `aria-label` descriptivas y una jerarquía de encabezados (`h1`, `h2`) lógica?

## 📊 IV. Reporte de Calidad UX

El tester informa del estado "emocional" y técnico de la interfaz:
- **Visual Sync:** 🟢 IDENTICAL (Respeta el diseño original).
- **Accessibility:** 🟠 NEEDS IMPROVEMENT (Falta contraste en el footer).
- **Responsiveness:** 🟢 MOBILE & DESKTOP OK.
- **Performance perceived:** 🟢 FAST (Interacciones inmediatas).

---

> **Check de Certificación:**
> - [ ] ¿He verificado el contraste de los colores principales?
> - [ ] ¿He navegado el flujo completo usando solo el teclado?
> - [ ] ¿He comprobado que el diseño no se rompe en resoluciones comunes como 375px (iPhone) y 1920px (Full HD)?
