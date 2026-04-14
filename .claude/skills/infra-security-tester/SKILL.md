---
name: infra-security-tester
description: Protocolo de auditoría de seguridad de infraestructura. Verifica el blindaje de puertos (nc/nmap), el aislamiento de redes internas y el cumplimiento de los límites de recursos establecidos. Su misión es certificar que ningún servicio sensible sea accesible desde el exterior del VPS.
user-invocable: false
agent: backend-tester
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 🏗️ I. Auditoría de Puertos (Port Shielding)

El tester debe proactivamente intentar conectar con los puertos internos desde un contexto simulado de red externa:

1. **Service Isolation (Data/Cache):** Ejecutar `nc -zv localhost [PORT]`. El resultado **DEBE** ser `Connection refused` desde el host externo para todos los servicios de infraestructura privados.
2. **App Listening:** Verificar que solo el puerto de entrada pública definido en la Spec responda correctamente.

## 🧱 II. Auditoría de Redes (Network Topology Audit)

1. **Red Privada:** Verificar que Redis y Postgres estén en una `network` privada de Docker sin enlace directo al gateway público del host.
2. **DNS Interno:** Confirmar que la App puede resolver nombres como `db` o `redis` sin usar IPs estáticas.
3. **SSL/SOP:** Validar que los headers de CORS estén configurados para permitir solo los orígenes seguros dictados en la Spec.

## 📦 III. Auditoría de Salud del Entorno

1. **Zombi Check:** Verificar que no existan contenedores huérfanos o volúmenes sin uso que consuman recursos del VPS.
2. **Limit Validation:** Comprobar mediante `docker stats --no-stream` que los contenedores están bajo su cuota de RAM (ej: App < 512MB).
3. **Secret Leak Audit:** Explorar el contenedor de la App para asegurar que no hay archivos `.env` reales dentro del sistema de archivos final de la imagen (solo variables de entorno activas).

## 📄 IV. Reporte de Certificación (Security Scan)

Al finalizar, el tester genera un ticket de validación para el devops:
- **Port 5432:** 🔴 BLOCKED (Success)
- **Port 6379:** 🔴 BLOCKED (Success)
- **Next.js Health:** 🟢 OK (Success)
- **RAM Caps:** 🟢 UNDER LIMIT (Success)

---

> **Check de Certificación:**
> - [ ] He verificado con `nc` que los puertos de DB/Redis están cerrados para el host externo.
> - [ ] He confirmado con `docker inspect` que no hay mapeos `0.0.0.0` para servicios internos.
> - [ ] He comprobado que los contenedores no exceden el 90% de su cuota de RAM asignada.
