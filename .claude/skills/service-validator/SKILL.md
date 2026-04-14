---
name: service-validator
description: Protocolo de auditoría de conectividad interna y blindaje de servicios. Asegura que los componentes del sistema se comuniquen correctamente y que los servicios sensibles estén aislados de la red pública.
user-invocable: false
agent: devops-integrator
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🛰️ I. Auditoría de Conectividad Interna

El agente debe validar que los servicios se "ven" entre sí dentro de la red de Docker:

1. **App → DB:** Validar mediante el driver de la aplicación o herramientas de red (`nc -zv db 5432`) que la base de datos acepta conexiones desde el contenedor de la App.
2. **App → Redis:** Validar que el socket de Redis está abierto y responde al `PING` interno.
3. **Persistencia:** Confirmar que los volúmenes están montados y que el usuario del contenedor tiene permisos de escritura en las rutas de datos.

## 🛡️ II. Protocolo de Blindaje (The Shield)

Certificar que el perímetro está cerrado:
- [ ] **Redis Isolation:** Verificar que el puerto 6379 NO está mapeado al host (`0.0.0.0:6379`). Solo debe ser accesible internamente.
- [ ] **Postgres Isolation:** Verificar que el puerto 5432 NO está expuesto al exterior.
- [ ] **Public Exposure:** Solo el puerto definido para la aplicación (ej. 3000) puede estar mapeado al host cuando sea estrictamente necesario para el despliegue.

## 🩺 III. Validación de Healthchecks

Confirmar que el "estado de salud" de los servicios es real:
- Ejecutar `docker ps` y verificar que el estado de cada contenedor sea `(healthy)`.
- Si un servicio está `(unhealthy)`, auditar los logs (`docker logs`) inmediatamente para identificar el fallo (ej. credenciales incorrectas, base de datos no inicializada).

## 📊 IV. Reporte de Entorno Activo

Al finalizar la validación, el agente debe generar un cuadro resumen:
- **DB Status:** (UP/DOWN/UNHEALTHY)
- **Redis Status:** (UP/DOWN/UNHEALTHY)
- **App Status:** (UP/DOWN/UNHEALTHY)
- **Network Isolation:** (CERTIFIED/FAILED)

---

> **Check de Certificación:**
> - [ ] Los contenedores informan salud `(healthy)`.
> - [ ] La App puede hacer query a la DB.
> - [ ] Redis responde al PING desde la App.
> - [ ] No hay puertos de DB/Redis expuestos al mundo.
