# PROJECT ARCHITECTURE: SimpleRegister (Refined Version 2.1)

Este documento define la estructura técnica del sistema consolidada en un único runtime, con protecciones avanzadas para integridad legal y estabilidad de recursos.

---

## 🛠 1. Stack Tecnológico (Justificación)

### 1.1. Core & Logic (Unified Runtime)
*   **Framework:** **Next.js 15 (App Router)**.
*   **Lenguaje:** **TypeScript**.
*   **ORM:** **Drizzle ORM**.
*   **Patrón de Negocio:** **Servicios Agnósticos**. La lógica de negocio (edad, periodos de gracia) se implementa en funciones puras de TypeScript fuera de los Server Components, permitiendo portabilidad futura (Clean Architecture).

### 1.2. Persistencia & Infraestructura
*   **Base de Datos:** **PostgreSQL 16**.
*   **Aislamiento de Seguridad:** Uso de dos esquemas:
    *   `public`: Datos de aplicación.
    *   `audit`: Logs inmutables (hashes SHA-256). Acceso vía usuario de DB con permisos restringidos de `INSERT` únicamente.
*   **Caché/Security:** **Redis**.

### 1.3. Orquestación y Límites de Recursos (Docker)
Para garantizar estabilidad en un VPS de bajos recursos (ej. **Tier 2GB RAM** nominal):
*   **Next.js:** Limitado a **512MB RAM** (con optimización `standalone`).
*   **Postgres:** Limitado a **256MB RAM** (ajustado para bajas conexiones).
*   **Redis:** Limitado a **128MB RAM** (uso exclusivo de sesiones y Rate Limit).
*   **Margen Operativo:** Reserva de ~1GB para el SO y Swap.

---

## 🏗 2. Mecanismos de Control Avanzado

### 2.1. Middleware de Alto Rendimiento (RNF4)
Para garantizar latencias < 300ms, el Middleware implementa:
*   **Timeout de Seguridad:** Si Redis no responde en < 50ms, el middleware asume modo **Graceful Degradation**: valida contra la DB directamente y loguea la alerta.
*   **Static Bypass:** Exclusión rigurosa de archivos estáticos y assets.

### 2.2. Ciclo de Vida de la Petición (Data Flow)
1. **Entrada:** Request -> Next.js Middleware.
2. **Seguridad:** Rate Limit (Redis) -> Auth Session Check (Redis/DB).
3. **Lógica:** Action/Server Component -> Domain Service (Pure TS).
4. **Persistencia:** Drizzle Transaction -> Postgres (Public Schema).
5. **Auditoría:** Post-Commit Hook -> Postgres (Audit Schema + SHA256).
6. **Salida:** Response.

### 2.3. Atomicidad y Reglas Legales (RF4)
Todas las operaciones que involucren reglas de negocio críticas (cambio de edad, purga de datos) se ejecutan bajo **Transacciones SQL**:
```typescript
await db.transaction(async (tx) => {
  // 1. Verificar última fecha de cambio (Lock for update)
  // 2. Ejecutar cambio si cumple > 365 días
  // 3. Registrar auditoría SHA-256
});
```
Esto garantiza que, ante fallos de red o peticiones concurrentes, los datos nunca queden en un estado inconsistente o ilegal.

### 2.4. Resiliencia de Tareas (Email & Purga)
*   **Worker Separado:** Se utilizará un contenedor independiente (o proceso secundario vía `PM2`) para la purga legal y envío de correos, evitando interferir con el runtime de Next.js.
*   **Idempotencia:** Cada tarea tiene un `unique_id` y control de reintentos para manejar fallos de red.

---

## 🧪 3. Estrategia de Calidad y Despliegue

### 3.1. Pirámide de Pruebas
*   **Unitarias (70%):** Enfoque agresivo en la capa de **Servicios** (lógica pura).
*   **Integración (20%):** Validación de transacciones y esquemas de base de datos.
*   **E2E (10%):** Playwright para flujos de "Registro hasta Verificación".

### 3.2. CI/CD (GitHub Actions)
*   **Secret Masking:** Los secretos de producción nunca tocan logs de auditoría.
*   **Blue/Green Deploy Lite:** Uso de `docker-compose up --build -d` con chequeos de salud (`healthcheck`) para minimizar el tiempo de inactividad.

---

## 📊 4. Observabilidad y Backups

*   **Logging:** `Pino` con Niveles (Error, Info, Audit). El nivel `Audit` se registra en una tabla persistente además de los logs de Docker.
*   **Off-site Backups:** Script diario automatizado hacia **Cloudflare R2** con cifrado AES-256 antes del envío.

---

---

## ⚡ 5. Disparo de Interrogatorio (Pressure Test)

1.  **¿Qué pasa si la base de datos de auditoría se llena?**
    *   *Respuesta:* El sistema entra en modo `Read-Only` para registros críticos. No se permiten nuevas acciones legales (RF7) hasta que se expanda el storage o se archive el log offline.
2.  **¿Cómo se garantiza la inmutabilidad de los logs ante un administrador malintencionado?**
    *   *Respuesta:* Se utiliza el esquema `audit` con un usuario de DB que carece de permisos de `UPDATE` o `DELETE`. Solo el proceso de despliegue tiene privilegios DDL.
3.  **¿Cuál es el "SPOF" (Single Point of Failure) identificado?**
    *   *Respuesta:* El VPS único. La mitigación reside en el plan de Backups diarios cifrados en Cloudflare R2 para recuperación en < 2 horas.

---

## 📝 6. Próximos Pasos (Infrastructure Ready)
- [ ] Implementar degradación de Redis en Middleware.
- [ ] Configurar esquemas `public` y `audit` con roles diferenciados.
- [ ] Definir `docker-compose.yaml` con las nuevas cuotas de RAM.
