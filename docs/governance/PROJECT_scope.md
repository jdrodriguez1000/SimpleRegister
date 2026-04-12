# PROJECT SCOPE: SimpleRegister

## 🎯 0. Contextualización
- **Visión:** Aplicación de registro y gestión de perfil de usuario con ciclo de vida controlado y recuperación de acceso.
- **Problema:** Necesidad de un sistema de identificación con validación de mayoría de edad en el origen y ventana de gracia para recuperación de cuentas.
- **Objetivo:** Garantizar que solo adultos accedan al sistema y permitir la gestión básica de identidad y recuperación de contraseña.
- **Audiencia:** Usuarios adultos (+18 años).

---

## 🛠 I. Requerimientos Funcionales (RF)

| ID | User Story (Como + Quiero + Para) | Criterios de Aceptación (Gherkin) | Estatus |
| :--- | :--- | :--- | :--- |
| **RF1** | **Registro y Verificación:** Como usuario quiero registrarme y verificar mi email (aceptando términos) para activar mi acceso. | **Scenario:** Registro de menor.<br>**Given** una fecha de nacimiento < 18 años.<br>**When** envío el formulario.<br>**Then** el sistema rechaza la creación y muestra error de edad.<br><br>**Scenario:** Aceptación de términos.<br>**Given** formulario de registro.<br>**When** no marco el checkbox de "Términos y Condiciones".<br>**Then** el botón de registro está deshabilitado o muestra error de validación.<br><br>**Scenario:** Verificación pendiente.<br>**Given** un registro exitoso.<br>**Then** la cuenta queda en estado `UNVERIFIED` y se envía un link de activación al email.<br><br>**Scenario:** Purga de huérfanos (Hard Delete).<br>**Given** una cuenta `UNVERIFIED` creada hace > 24 horas.<br>**Then** el sistema elimina el registro permanentemente (sin periodo de gracia). | 🟢 AUTORIZADO |
| **RF2** | **Reactivación:** Como usuario en periodo de gracia (<= 30 días), quiero reactivar mi cuenta mediante un código de seguridad enviado a mi correo. | **Scenario:** Intento de login en cuenta borrada.<br>**Given** cuenta borrada hace 30 días o menos.<br>**When** ingreso credenciales válidas.<br>**Then** el sistema bloquea el acceso total y muestra "Cuenta en periodo de baja".<br>**And** ofrece opción de "Enviar código de recuperación".<br><br>**Scenario:** Código solicitado y reenvío.<br>**Given** solicitud de reactivación.<br>**When** presiono "Enviar código".<br>**Then** el sistema envía token de 6 dígitos.<br>**And** el botón de reenvío se bloquea por 2 minutos (Cooldown).<br><br>**Scenario:** Control de reintentos.<br>**Given** un código activo.<br>**When** ingreso el código errado 3 veces.<br>**Then** el código se invalida y debo solicitar uno nuevo.<br><br>**Scenario:** Confirmación exitosa.<br>**When** ingreso el código correcto en < 10 min.<br>**Then** el registro `deleted_at` se anula y recupero acceso total. | 🟢 AUTORIZADO |
| **RF3** | **Perfil Obligatorio:** Como usuario debo completar TODOS mis datos tras el login para usar la App. | **Scenario:** Bloqueo de navegación (UI).<br>**Given** login exitoso sin todos los campos (Nombre: max 50, Apellido: max 50, Teléfono: max 20 en formato E.164).<br>**When** intento navegar a cualquier ruta QUE NO SEA `/perfil` o `/logout`.<br>**Then** el sistema me redirige forzosamente a `/perfil`.<br><br>**Scenario:** Protección de API (Backend).<br>**Given** usuario autenticado con perfil incompleto.<br>**When** intenta consumir un endpoint de negocio (que no sea `/me` o `/perfil`).<br>**Then** la API responde con `403 Forbidden` (Profile Incomplete). | 🟢 AUTORIZADO |
| **RF4** | **Gestión de Perfil:** Como usuario quiero editar mis datos (incluida fecha nac.) para mantener mi info actualizada (con límites de seguridad). | **Scenario:** Edición de fecha (Re-verificación).<br>**When** intento cambiar mi fecha de nacimiento.<br>**And** la nueva fecha es >= 18 años.<br>**And** no he cambiado mi fecha en los últimos 365 días (validado contra `last_birthdate_change_at`).<br>**Then** el sistema solicita la contraseña actual para confirmar el cambio.<br>**Then** el sistema guarda el cambio y registra la auditoría. | 🟢 AUTORIZADO |
| **RF6** | **Recuperación:** Como usuario quiero recuperar mi contraseña mediante mi correo electrónico. | **Scenario:** Prevención de bloqueo (DoS).<br>**When** se solicita recuperación por 1ra vez.<br>**Then** se envía el token.<br>**When** se solicita una 2da vez consecutiva.<br>**Then** el sistema requiere completar un **CAPTCHA**.<br>**And** el Rate Limit de 3 peticiones se aplica por combinación de `Email + IP` para evitar el bloqueo malintencionado de cuentas ajenas. | 🟢 AUTORIZADO |
| **RF7** | **Consentimiento Legal:** Como sistema debo persistir la aceptación de términos para cumplimiento legal. | **Scenario:** Registro de auditoría inmutable.<br>**When** el usuario se registra.<br>**Then** se guarda el registro en `audit_consents` usando un **Hash (SHA-256) del Email** como identificador estable.<br>**And** este registro persiste aunque el usuario sea eliminado por purga física (`Hard Delete`). | 🟢 AUTORIZADO |

---

## ⚖️ II. Análisis de Reglas de Negocio y Borde

### RF1 - Validación de Origen y Activación
- **Filtro de Edad:** Validación obligatoria en el **Backend**.
- **Activación:** Las cuentas nuevas no pueden loguearse hasta que el email sea verificado.
- **Unicidad:** Un email en "Periodo de Gracia" no puede usarse para un nuevo registro.
- **Anti-Abuso:** Rate limit de 5 intentos de registro por IP/día para mitigar fuerza bruta sobre la fecha de nacimiento.
- **Purga Unverified:** Eliminación automática de cuentas no verificadas tras 24 horas. El email utilizado queda bloqueado para nuevos registros por un periodo de **7 días adicionales** tras la purga para prevenir abusos.

### RF2 & RF5 - Ciclo de Vida (Purga Automatizada)
- **Periodo de Gracia:** 30 días calendario (720 horas desde el `deleted_at`).
- **Mecanismo de Purga:** Tarea programada (Cron Job) que ejecuta un `HARD DELETE` de registros donde `deleted_at < (now - 30 days)`.
- **TTL de Código:** El código de reactivación (`RF2`) tiene una validez de **10 minutos** desde su emisión.

### RF3 - Perfil y Sesión
- **Campos Obligatorios:** Nombre, Apellido, Teléfono (Validación E.164, sin verificación OTP), Fecha de Nacimiento.
- **Persistencia de Sesión:** Uso de **JWT (JSON Web Tokens)** con Refresh Tokens.<br>- **TTL Access Token:** Duración de **1 hora** (3600s).<br>- **TTL Refresh Token:** Duración de **72 horas** (Inactividad).<br>- **Estrategia de Invalidación:** El sistema debe verificar en cada solicitud crítica (o mediante un middleware de base de datos) que la cuenta asociada NO tenga un `deleted_at` activo, garantizando la denegación de acceso inmediata post-baja.

### RF7 - Cumplimiento Legal
- **Versionamiento:** Si los términos cambian, el sistema debe permitir forzar una nueva aceptación antes de continuar el uso.

### RF6 - Password Reset (Seguridad del Token)
- **TTL (Time to Live):** El token de recuperación tendrá una validez máxima de **1 hora** desde su generación.
- **Unicidad:** El uso del token lo invalida inmediatamente (Single-use token).
- **Scope:** El Rate Limit se aplica de forma estricta por correo electrónico de la cuenta.

### RF5 - Seguridad de Sesión
- **Global Sign-out:** Al solicitar la baja, el sistema debe invalidar el `refresh_token` actual y marcar todos los tokens de acceso previos como inválidos en la capa de persistencia (si aplica) o mediante listas de revocación.

---

## 📑 III. Matriz de Requerimientos No Funcionales (RNF)

| ID | Atributo | Requerimiento Técnico | Métrica |
| :--- | :--- | :--- | :--- |
| **RNF1** | **Seguridad** | Fortalezas de Contraseña. | Min 8 chars, 1 Mayús, 1 Minús, 1 Núm, 1 Especial. |
| **RNF2** | **Persistencia** | Registro de baja. | Columna `deleted_at` (Timestamp). |
| **RNF3** | **Integridad** | Validación Backend. | `Now - Birthdate >= 18` (Server-side validation). |
| **RNF4** | **Usabilidad** | Latencia de Respuesta. | Interacción (Click a Feedback) < 100ms. Response API < 300ms. |
| **RNF5** | **Disponibilidad** | SLA de Infraestructura. | 99.9% disponibilidad anual. |
| **RNF6** | **Resiliencia** | Fallo de Notificación (Email). | Reintentos con Backoff Exponencial (Max 3). |
| **RNF7** | **Seguridad** | Rate Limiting (Reset/Reactivation).| Max 3 peticiones / hora / Cuenta para acciones de recuperación. |
| **RNF8** | **Mantenibilidad**| Purga Automática. | Job diario (Postgres Task / Cron) con logs de éxito/error. |
| **RNF9** | **Seguridad** | Expiración y Revocación. | Access Token: 1h / Refresh Token: 72h + Validación vía **Caché (Redis/similar)** de estatus activo. <br>**Política Fail-Safe:** Ante caída de la caché, el sistema debe **bloquear (Fail-Closed)** el acceso a recursos protegidos para garantizar la seguridad. |

---

## 🚫 IV. Fuera de Alcance (Out of Scope)
- Registro vía OAuth (Google/Facebook).
- Cambio de dirección de correo electrónico.
- Gestión de fotos de perfil.
- Soporte multi-idioma (Solo Español Latam).

