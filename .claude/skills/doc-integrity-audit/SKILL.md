---
name: doc-integrity-audit
description: Sincronización entre código, Specs y documentación de gobernanza. Asegura que la realidad técnica (el código) sea un reflejo fiel del diseño autorizado en el SDD.
user-invocable: false
agent: backend-reviewer
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🔍 I. Protocolo de Sincronía (Code-to-Spec)

Antes de cualquier aprobación, el revisor debe certificar la coherencia documental:

1. **Spec Alignment:** ¿El nombre del endpoint y el payload del código coincidan 1:1 con lo autorizado en la `PROJECT_spec.md`? 
2. **Backlog Audit:** ¿La tarea realizada ha sido marcada correctamente en el `PROJECT_backlog.md`? Si la tarea introduce cambios que afectan a tareas futuras, ¿se han actualizado dichas tareas?
3. **Architecture Match:** ¿El código sigue los diagramas de flujo y diagramas entidad-relación definidos en la `PROJECT_architecture.md`?

## 📐 II. Mantenimiento de la Documentación Técnica

El revisor debe proponer actualizaciones si detecta discrepancias necesarias:

- **Endpoints y Payloads:** Si por motivos de implementación se ha tenido que desviar levemente de la Spec (con aprobación previa), el revisor **DEBE** actualizar la `PROJECT_spec.md` para reflejar la realidad del código.
- **Project Context:** Actualizar el `README.md` o los archivos de configuración local si el cambio introduce nuevas dependencias o variables de entorno.
- **Audit Logs:** Asegurar que el cambio quede registrado en el índice de auditoría correspondiente (`audits/governance/`).

## 📜 III. El Veredicto de Integridad

El revisor emite su reporte de sincronía:
- **Spec Sync:** 🟢 IDENTICAL (No hay divergencia).
- **Backlog Sync:** 🟢 UPDATED (Tarea tachada/actualizada).
- **Doc Quality:** 🟢 HIGH (Códigos de error y formatos documentados).

---

> **Check de Certificación:**
> - [ ] ¿He verificado que el código no hace nade que la Spec no autorice?
> - [ ] ¿El nuevo endpoint aparece ya documentado correctamente?
> - [ ] ¿He actualizado el estado de la tarea en el backlog?
