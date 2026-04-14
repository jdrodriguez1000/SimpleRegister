---
name: secrets-guard
description: Protocolo de gestión segura de variables de entorno y protección de datos sensibles. Asegura que ninguna credencial sea filtrada al repositorio y que el entorno sea reproducible.
user-invocable: false
agent: devops-integrator
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🔒 I. Regla de Oro: Aislamiento Total

1. **PROHIBIDO** subir archivos `.env` al control de versiones.
2. **OBLIGATORIO** mantener un `.env.example` actualizado con todos los nombres de las variables pero con valores falsos o vacíos.
3. **MÁSCARA DE SEGURIDAD**: Nunca imprimir valores de variables de entorno en los logs de consola durante el build o ejecución.

## 🛠️ II. Protocolo de Sincronización (The Spec-Sync)

Cada vez que el `secrets-guard` actúa, debe verificar:
- [ ] ¿Están todas las variables definidas en `PROJECT_spec.md` presentes en el `.env.example`?
- [ ] ¿Existe una descripción clara de para qué sirve cada variable en el archivo de ejemplo?
- [ ] ¿Se ha verificado el `.gitignore` para confirmar que `*.env` está en la lista de exclusión?

## 🧩 III. Estructura del .env.example

El archivo de ejemplo debe estar organizado por bloques lógicos:

```env
# --- DATABASE ---
DATABASE_URL=postgres://user:password@localhost:5432/dbname

# --- SECURITY ---
X_HEALTH_KEY=uuid-seed-here
RATE_LIMIT_MAX=10

# --- INFRA ---
REDIS_URL=redis://localhost:6379
```

## 🚨 IV. Procedimiento de Fuga (Leak Protocol)

En caso de detectar que un secreto ha sido commiteado por error:
1. **Invalidación Inmediata:** Rotar la credencial en el servicio original.
2. **Limpieza de Historial:** Informar al usuario para usar `git filter-repo` o `bfg` para limpiar el historial de Git (fuera del alcance del agente).
3. **Auditoría:** Revisar por qué falló el `.gitignore`.

---

> **Check de Certificación:**
> - [ ] `.gitignore` contiene `.env`.
> - [ ] `.env.example` no tiene secretos reales.
> - [ ] El agente ha validado que los nombres de las variables coinciden con la capa de servicios.
