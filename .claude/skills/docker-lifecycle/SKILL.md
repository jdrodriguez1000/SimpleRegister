---
name: docker-lifecycle
description: Estándar de orquestación, optimización y resiliencia para contenedores en VPS de recursos limitados. Este protocolo garantiza que el sistema no exceda las cuotas de RAM y que el downtime sea mínimo.
user-invocable: false
agent: devops-integrator
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 📊 I. Límites de Recursos (Capping)

Es **obligatorio** configurar límites de RAM en `docker-compose.yml` para evitar el agotamiento de memoria del host.

| Servicio | Cuota RAM (Max) | Reservada | Reinicio |
| :--- | :--- | :--- | :--- |
| **Next.js (App)** | 512MB | 256MB | strictly unless-stopped |
| **PostgreSQL** | 256MB | 128MB | strictly unless-stopped |
| **Redis** | 128MB | 64MB | strictly unless-stopped |

### Ejemplo de Configuración:
```yaml
deploy:
  resources:
    limits:
      memory: 512M
    reservations:
      memory: 256M
```

## 🏗️ II. Estándar de Construcción (Dockerfile)

### 1. Multistage Build Obligatorio
Todo `Dockerfile` debe separar la etapa de construcción (`build`) de la de ejecución (`runner`) para reducir el peso de la imagen y la superficie de ataque.

### 2. Imágenes Base
- Siempre usar versiones `alpine` o `slim`.
- Bloquear la versión (ej: `node:20-alpine`, nunca `node:latest`).

### 3. Seguridad de Usuario
- Nunca correr procesos como `root`. Crear un usuario de sistema y asignarle el proceso.

## 🩺 III. Protocolo de Salud (Healthcheck)

Ningún servicio se considera "desplegado" si no puede auto-reportar su estado.

- **Postgres:** `test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]`
- **Redis:** `test: ["CMD", "redis-cli", "ping"]`
- **Next.js:** Crear un endpoint interno `/api/health` si es necesario o usar `curl` contra el puerto local.

## 🔄 IV. Ciclo de Vida y Limpieza

1. **Persistencia:** Solo los datos de Postgres (`/var/lib/postgresql/data`) y logs críticos tienen volúmenes persistentes.
2. **Redes:** Uso de `networks` internas para aislar la DB y Redis de la red pública. Solo el contenedor de la App puede tener el puerto 3000 expuesto (vía Reverse Proxy o directo).
3. **Limpieza:** Antes de cada rebuild, ejecutar `docker system prune -f` para recuperar espacio en disco.

---

> **Check de Certificación:** Antes de cerrar una tarea de Docker, verifica:
> - [ ] ¿He puesto límites de RAM?
> - [ ] ¿Es una imagen Multistage?
> - [ ] ¿Tiene Healthcheck funcional?
> - [ ] ¿La DB está aislada en una red interna?
