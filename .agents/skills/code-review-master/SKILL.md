---
name: code-review-master
description: Auditoría de legibilidad, patrones y Clean Code. Asegura que el código sea comprensible para cualquier humano y respete las leyes de limpieza del proyecto.
user-invocable: false
agent: backend-reviewer
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🔍 I. El Proceso de Escrutinio

El revisor debe seguir este orden de auditoría sobre el código del Coder:

1. **Intención e Identidad:** ¿Los nombres de las funciones y variables explican qué hacen sin necesidad de comentarios? (ej: `isUserAuthorized` vs `checkU`).
2. **Complejidad Ciclomática:** ¿Hay demasiados `if/else` anidados? ¿Se puede simplificar la lógica usando cláusulas de guarda (*Guard Clauses*)?
3. **Manejo de Silencios:** ¿Se están capturando errores y silenciándolos (`catch {}` vacío)? **RECHAZO ABSOLUTO.** Todo error debe ser manejado, logueado o transformado según la Spec.
4. **Hardcoding Audit:** ¿Existen números mágicos (ej: `3600`) o strings fijos que deberían ser constantes o variables de entorno?

## 📐 II. Alineación con Estándares

Confirmar que el estilo visual es el mismo en todo el proyecto:
- **Higiene de Commits:** ¿El mensaje del cambio es descriptivo y sigue la convención del proyecto (ej: `feat:`, `fix:`)?
- **Espaciados y Tipado:** ¿Se están usando los tipos correctamente o hay abusos de `any`? (En entornos tipados).
- **Logs de Auditoría:** ¿El código incluye los logs necesarios para que el `devops-integrator` pueda debugear en producción?

## 📜 III. El Veredicto (Feedback)

El agente debe responder con una de estas tres etiquetas claras:

1. **✅ APPROVED:** El código es perfecto, respeta la Spec y es mantenible.
2. **⚠️ MINOR CHANGES:** El código funciona pero tiene detalles de estilo o legibilidad que deben corregirse (sin re-testeo profundo).
3. **❌ REJECTED:** El código tiene fallos estructurales, falta de manejo de errores o viola la lógica de la Spec. Se requiere corrección total y nuevo ciclo de TDD.

---

> **Check de Certificación:**
> - [ ] ¿Puedo entender lo que hace el código en menos de 30 segundos?
> - [ ] ¿Se han eliminado todos los "Magic Numbers"?
> - [ ] ¿El código refleja exactamente lo que se acordó en la tarea?
