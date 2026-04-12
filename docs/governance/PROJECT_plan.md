# PROJECT PLAN: SimpleRegister (Entregables por Iteración)

Este plan establece una hoja de ruta de **Entregas Tangibles**. Cada iteración se centra en la producción de resultados verificables siguiendo el flujo: `Spec Vacía -> Definición de RF/RNF -> Entregable Funcional`.

---

## 🚀 Hoja de Ruta de Entregables

### Iteración 1: Cimientos y Performance Base
*   **Target:** **RNF4** (Latencia), **RNF5** (SLA).
*   **Entregables Principales:**
    *   Entorno de desarrollo Next.js 15 + Docker Compose (Stack completo).
    *   Dashboard de salud con respuesta de API < 300ms.
    *   Bóveda de Secretos con Keys de Email y CAPTCHA validadas.

### Iteración 2: Registro y Validación de Origen
*   **Target:** **RF1** (Registro), **RNF1** (Password), **RNF3** (Edad), **RNF6** (Email).
*   **Entregables Principales:**
    *   Flujo de Registro funcional con validación de mayoría de edad (Backend).
    *   Servicio de Notificación con envío de links de activación activado.

### Iteración 3: Seguridad de Sesión y Revocación
*   **Target:** **RNF9** (Límites JWT y Caché de Revocación).
*   **Entregables Principales:**
    *   Middleware de Autenticación con política Fail-Closed (Seguridad Redis).
    *   Sistema de Refresh Tokens persistente en base de datos.

### Iteración 4: Control de Navegación e Identidad Obligatoria
*   **Target:** **RF3** (Perfil Obligatorio).
*   **Entregables Principales:**
    *   Interceptor de rutas forzoso para perfiles incompletos.
    *   Capa de protección de API (Guardias) para recursos protegidos.

### Iteración 5: Gestión de Perfil y Persistencia de Baja
*   **Target:** **RF4** (Gestión Perfil), **RNF2** (Persistence `deleted_at`).
*   **Entregables Principales:**
    *   Interfaz de Perfil con lógica de bloqueo de 365 días implementada.
    *   Mecanismo de "Baja Voluntaria" (Soft Delete) sincronizado con auth.

### Iteración 6: Recuperación Segura y Anti-DoS
*   **Target:** **RF2** (Reactivación), **RF6** (Recuperación), **RNF7** (Rate Limiting).
*   **Entregables Principales:**
    *   Módulo de Reactivación con códigos de 6 dígitos y cooldown.
    *   Formulario de recuperación con protección CAPTCHA y Rate Limit IP-based.

### Iteración 7: Auditoría Legal y Purga Física
*   **Target:** **RF5** (Purga/Sesión), **RF7** (Consentimiento SHA-256), **RNF8** (Mantenibilidad).
*   **Entregables Principales:**
    *   Esquema de Auditoría inmutable con hashes SHA-256 generados.
    *   Worker diario automatizado para purga física de registros expirados.

### Iteración 8: Estabilización Final (Polish)
*   **Target:** Calidad Premium y Despliegue.
*   **Entregables Principales:**
    *   Bundle de producción optimizado y libre de bugs críticos.
    *   Aplicación desplegada con UX/UI refinada (Wow Effect).

---

## 📊 Matriz de Trazabilidad Cruzada

| Requerimiento | Tipo | Iteración de Trabajo |
| :--- | :--- | :--- |
| **RF1** | Funcional | Iteración 2 |
| **RF2** | Funcional | Iteración 6 |
| **RF3** | Funcional | Iteración 4 |
| **RF4** | Funcional | Iteración 5 |
| **RF5** | Funcional | Iteración 7 |
| **RF6** | Funcional | Iteración 6 |
| **RF7** | Funcional | Iteración 7 |
| **RNF1** | Técnico | Iteración 2 |
| **RNF2** | Técnico | Iteración 5 |
| **RNF3** | Técnico | Iteración 2 |
| **RNF4** | Técnico | Iteración 1 |
| **RNF5** | Técnico | Iteración 1 |
| **RNF6** | Técnico | Iteración 2 |
| **RNF7** | Técnico | Iteración 6 |
| **RNF8** | Técnico | Iteración 7 |
| **RNF9** | Técnico | Iteración 3 |

---

**Estado del Documento:** `AUTORIZADO (🟢)`
