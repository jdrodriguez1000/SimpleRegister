---
name: e2e-test-automation
description: Automatización de flujos completos del usuario. Asegura que la navegación entre páginas y la persistencia de datos desde la UI sea coherente y funcional.
user-invocable: false
agent: frontend-tester
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🛤️ I. El Viaje del Usuario (User Journey)

El tester debe automatizar los flujos críticos (Happy Path) y los caminos alternativos (Sad Path):

1. **Flujo de Registro (CRUD):** Simular al usuario completando un formulario de salud, enviándolo y confirmando que los datos se reflejan en la UI (y en la API).
2. **Navegación y Autenticación:** Verificar que el usuario no puede acceder a rutas privadas sin sesión o que los botones llevan a las páginas correctas.
3. **Escenarios de Fallo:** Provocar latencia o errores de red para confirmar que el flujo no se rompe catastróficamente sino que informa al usuario.

## 📐 II. Arquitectura de los Tests E2E

Para asegurar que los tests no sean "frágiles" (brittle), el agente debe aplicar:

- **Page Object Model (POM):** Abstraer los elementos de la página en clases o funciones separadas de la lógica del test para facilitar el mantenimiento.
- **Selectores Robustos:** Priorizar selectores basados en accesibilidad (ej: `aria-label`, `button[name='login']`) o IDs técnicos específicos, evitando selectores CSS frágiles (ej: `.div > .span`).
- **Wait for, Not Sleep:** No usar esperas fijas (`delay(1000)`). Usar "esperas inteligentes" por la aparición de elementos o respuestas de red.

## 🧪 III. Validación de Salud Operativa

Al final del test, el agente debe certificar:
- **UI Consistency:** ¿Las rutas cambiaron como se esperaba?
- **Data Persistence:** Al recargar la página o volver a ella, ¿los datos guardados siguen allí?
- **Console Audit:** ¿Hubo errores de 4xx o 5xx en el tráfico de red durante el flujo?

---

> **Check de Certificación:**
> - [ ] ¿He verificado que el flujo completo (E2E) no tiene errores de consola?
> - [ ] ¿He usado esperas inteligentes en lugar de tiempos fijos?
> - [ ] ¿He testeado al menos un escenario de error durante el viaje del usuario?
