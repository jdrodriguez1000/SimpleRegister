---
name: frontend-doc-integrity
description: Sincronización entre la UI real y la Spec técnica. Asegura que los cambios en la interfaz, estados y consumos de API estén reflejados en la PROJECT_spec.md.
user-invocable: false
agent: frontend-reviewer
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🛰️ I. Auditoría de Datos e Interfaz

El revisor debe certificar la coherencia documental:

1. **Spec Matching:** ¿El payload que envía el frontend al backend es idéntico al autorizado en la `PROJECT_spec.md`? 
2. **Backlog Audit:** ¿La tarea de frontend realizada ha sido marcada correctamente en el `PROJECT_backlog.md`? 
3. **State & Routes:** ¿El flujo de navegación del usuario y los estados globales (Login, Session, Errors) coinciden con el diseño inicial?

## 📐 II. Mantenimiento del SDD de Front

- **Endpoints Consumption:** Si por motivos de implementación se ha tenido que desviar levemente del consumo de API original, el revisor **DEBE** actualizar la `PROJECT_spec.md`.
- **Styling Standards:** Si se ha añadido una nueva variable global de estilo, ¿está documentada en el `index.css` principal o en la guía de estilos?
- **Audit Logs:** Asegurar que el cambio quede registrado en el índice de auditoría de gobernanza.

## 📜 III. El Veredicto de Integridad Front

Al final del review, el agente emite su reporte de sincronía:
- **Spec Sync:** 🟢 IDENTICAL (Frontend y Backend sincronizados).
- **Backlog Sync:** 🟢 UPDATED.
- **Visual Spec:** 🟢 HIGH (Fidelidad total al diseño).

---

> **Check de Certificación:**
> - [ ] ¿He verificado que el payload del frontend no tiene campos extra no autorizados?
> - [ ] ¿El nuevo flujo de usuario aparece ya documentado correctamente?
> - [ ] ¿He actualizado el estado de la tarea en el backlog?
