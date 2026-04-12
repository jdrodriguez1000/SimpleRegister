---
name: frontend-tdd-master
description: Protocolo RED-GREEN para componentes e interacciones de UI. Regula el ciclo de vida de un componente desde la definición de su comportamiento hasta su certificación visual.
user-invocable: false
agent: frontend-tester
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🔄 I. El Ciclo RED-GREEN en UI

El tester debe guiar el desarrollo de componentes siguiendo estos pasos:

1. **🚩 RED (Expectativa de Interfaz):**
   - Escribir un test que busque un elemento específico (ej: `button`, `input`) o un texto basado en la Spec.
   - Definir qué debe ocurrir ante un evento (ej: "Al hacer clic, debería llamar a la API").
   - **Confirmar el fallo:** El test debe fallar porque el componente no existe o no tiene esa lógica.

2. **✅ GREEN (Renderizado Mínimo):**
   - El Coder implementa la estructura mínima (HTML/Componente) para que el test pase.
   - El objetivo es la veracidad funcional, no la estética final.

3. **🏗️ REFACTOR (Higiene y Estilos):**
   - Aplicar estilos (CSS), mejorar la estructura de props y limpiar el código.
   - El Tester asegura que tras el CSS, el componente **sigue funcionando funcionalmente**.

## 🧪 II. Los 4 Estados Obligatorios

Todo test de componente debe validar cómo se ve y comporta el UI en estas situaciones:
- **Empty State:** ¿Qué ve el usuario cuando no hay datos?
- **Loading State:** ¿Hay un indicador claro de carga mientras se espera a la API?
- **Success State:** ¿Se renderizan los datos correctamente según el contrato de la Spec?
- **Error State:** ¿El mensaje de error es amigable y permite al usuario reintentar?

## 🖱️ III. Validación de Interacciones (User Events)

- **Input Validation:** Simular entradas de usuario erróneas y verificar que los mensajes de validación aparezcan.
- **Form Submission:** Asegurar que el formulario no se envíe si hay errores y que se desactive el botón de "Enviar" durante la carga.
- **Accessibility Check:** Verificar que los elementos tengan roles ARIA correctos y sean navegables vía teclado (Tab).

---

> **Check de Certificación:**
> - [ ] ¿He verificado que el botón/input es accesible mediante `getByRole` o `getByLabelText`?
> - [ ] ¿He testeado el componente con un "Mock de API" lento para ver el estado de carga?
> - [ ] ¿El componente informa de errores de forma visual?
