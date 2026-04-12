---
name: ui-code-review-master
description: Auditoría de legibilidad en componentes, nomenclatura y eficiencia en el renderizado. Asegura que el código visual sea modular, fácil de mantener y performante.
user-invocable: false
agent: frontend-reviewer
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🔍 I. Protocolo de Escrutinio UI

El revisor debe realizar una auditoría técnica profunda sobre los componentes de UI:

1. **Eficiencia de Renderizado:** ¿Existen re-renders innecesarios? ¿Se están usando dependencias pesadas que podrían optimizarse?
2. **Nomenclatura y Roles:** ¿Los nombres de las clases o componentes describen su propósito y no su apariencia (ej: `MainAction` en lugar de `BlueButtonLarge`)?
3. **Manejo de Estados:** ¿Los estados de error y carga se implementan de forma genérica y reutilizable?
4. **Prop-Drilling:** ¿Se está pasando información por demasiados niveles de componentes hijos de forma innecesaria?

## 📐 II. Limpieza de Estilos (CSS/Styling)

- **Unused Rules:** Asegurar que no hay selectores o reglas CSS que no se utilicen en el componente.
- **Specificity:** Evitar el uso excesivo de `!important` y selectores ultra-específicos que dificulten el mantenimiento futuro.
- **Layout Logic:** Certificar que el uso de Grid o Flexbox sea la solución más limpia y moderna para el problema de maquetación presentado.

## 📜 III. El Veredicto Técnico

- **✅ APPROVED:** UI limpia, modular y eficiente.
- **⚠️ RE-FACTOR UI:** Problemas de rendimiento o nombres confusos.
- **❌ REJECTED:** Fallos de lógica en el renderizado o violación de las reglas de oro del frontend.
