# PROJECT SPEC: SimpleRegister (Contratos Técnicos)

Este documento define las interfaces de comunicación entre el Backend y el Frontend, asegurando la integridad de los datos y el cumplimiento de los RNF desde la primera línea de código.

---

## Configuración Global (Iteración 1)

*   **URL Base (Development):** `http://localhost:3000`
*   **Protocolo CORS:**
    *   **Allowed Origins:** `http://localhost:5173` (Vite Default)
    *   **Allowed Methods:** `GET`, `POST`, `OPTIONS`
    *   **Allowed Headers:** `Accept`, `Content-Type`, `X-Health-Key`, `Accept-Language`
    *   **Exposed Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`

*   **Convención de Rate Limit (Conflict Resolution):** Cuando múltiples límites aplican a una misma petición (ej. Global 10/min vs Registro 5/día), las cabeceras `X-RateLimit-*` siempre reportarán el estado del **límite más restrictivo** (el que tenga el menor valor en `Remaining`).

---

## Iteración 1: Cimientos y Performance Base

### ⚙️ Sección Backend (The Provider)

*   **Definición de Endpoints:**
    *   **Verbo:** `GET`
    *   **Ruta:** `/api/v1/health`
    *   **Versionamiento:** `/v1/`
    *   **Descripción:** Punto de control de salud del sistema (**RNF4**, **RNF5**).
        *   **Acceso Público:** Devuelve solo `status` y `version`.
        *   **Rate Limiting:** 10 req/min por IP. Algoritmo **Fixed Window** (Reinicio al inicio de cada ventana de 60s).
        *   **Acceso Privado:** Requiere header `X-Health-Key`. Devuelve detalle completo de dependencias y métricas. Exento de Rate Limit.

*   **Esquema de Request:**
    *   **Headers:**
        *   `Accept: application/json`
        *   `X-Health-Key`: Secret Key (UUID v4). Requerido para ver detalles de infraestructura.

    *   **Esquema de Response:**
    *   **Headers:**
        *   `Content-Type: application/json`
        *   `X-RateLimit-Limit`: 10 (Solo para Acceso Público)
        *   `X-RateLimit-Remaining`: Peticiones restantes en la ventana actual.
        *   `X-RateLimit-Reset`: Unix Epoch (Segundos UTC del próximo reinicio de cuota).
        *   `Retry-After`: Delta-seconds (Segundos a esperar antes del reintento).
    *   **Success (200 OK):**
        ```json
        {
          "status": "success",
          "version": "1.0.0",
          "timestamp": "2026-04-11T20:00:00.000Z", /* ISO-8601 UTC con Milisegundos */
          /* Campos detallados solo si X-Health-Key es válida */
          "performance": {
            "api_latency_ms": 45.3,
            "latency_type": "Server-side processing (including DB/Redis check)"
          },
        "dependencies": {
            "database": "connected",
            "redis": "connected",
            "email_service": "config_valid",
            "captcha_service": "config_valid"
          }
        }
        ```
    *   **Errors (400 Bad Request - Formato Inválido):**
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "MALFORMED_REQUEST",
          "message": "Formato de X-Health-Key inválido (Debe ser UUID v4)."
        }
        ```
    *   **Errors (403 Forbidden - Llave Incorrecta):**
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "AUTH_REQUIRED",
          "message": "Llave de salud incorrecta o expirada."
        }
        ```
    *   **Errors (429 Too Many Requests):**
        *   **Headers:** `Retry-After: <seconds>`
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "RATE_LIMIT_EXCEEDED",
          "message": "Demasiadas peticiones. Límite de 10 req/min excedido."
        }
        ```
    *   **Errors (406 Not Acceptable - Negociación de Contenido):**
        *   **Disparador:** Header `Accept` distinto de `application/json` o `*/*`.
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "2026-04-11T20:00:00.000Z",
          "error_code": "CONTENT_TYPE_NOT_SUPPORTED",
          "message": "Sólo se soporta respuesta en formato JSON."
        }
        ```

    *   **Errors (405 Method Not Allowed):**
        *   **Disparador:** Uso de un verbo HTTP no soportado en un endpoint existente.
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "METHOD_NOT_ALLOWED",
          "message": "Método HTTP no permitido para esta ruta."
        }
        ```

    *   **Errors (503 Service Unavailable - Fallo Crítico):**
        *   **Disparador:** `database` o `redis` en estado `disconnected`.
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "SYSTEM_DEGRADED",
          "message": "Servicios críticos no disponibles.",
          "unhealthy_services": ["database", "redis"]
        }
        ```

    *   **Errors (500 Internal Server Error):**
        *   **Disparador:** Excepción no controlada en la lógica de aplicación.
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "INTERNAL_SERVER_ERROR",
          "message": "Ha ocurrido un error inesperado. Intente más tarde."
        }
        ```

    *   **Protocolo de Error (SOP):** Para garantizar el cumplimiento de **RNF5**, toda respuesta (2xx, 4xx, 5xx) debe incluir los campos `version` y `timestamp`. Los headers `X-RateLimit-*` se incluyen incluso en respuestas de error 4xx/5xx si aplican para la IP.
    *   **Privacidad de Performance:** El bloque `performance` es considerado **Metadata Privada**. Siguiendo el diseño de la Iteración 1, su presencia en la respuesta (éxito o error) está estrictamente condicionada a la presencia de un `X-Health-Key` válido. En accesos públicos, este bloque debe omitirse de la respuesta JSON.
    *   **Métrica de Latencia:** El campo `api_latency_ms` es un **Float (ms)** (mínimo y máximo 2 decimales) que mide el ciclo de vida completo de la petición en el servidor.
    *   **Negociación por Defecto:** Si el header `Accept` está ausente, el servidor asumirá `application/json` por defecto.
    *   **Criterios de Degradación (SLA):**
        *   **SLA Green:** Latencia < 200ms.
        *   **SLA Warning:** 200ms <= Latencia < 500ms.
        *   **SLA Critical:** Latencia >= 500ms (Mantiene respuesta 200 OK pero notifica degradación en logs).
    *   **Definición de Criticidad y Timeouts:**
        *   **Críticos:** `database` y `redis`. Su fallo dispara un **HTTP 503** con el código `SYSTEM_DEGRADED`. El sistema debe ser capaz de emitir esta respuesta JSON incluso con la DB caída (Usar constantes para `version`).
        *   **No Críticos:** `email_service` y `captcha_service`. Solo se validan a nivel de **configuración**. Estados posibles: `config_valid` o `error`.
    *   **Validación de Secretos (Configuración):** El estado de los servicios no críticos se determina validando la existence y formato de las llaves en la Bóveda de Secretos sin realizar un envío real.
    *   **Lógica de Fallback Público:** Si el header `X-Health-Key` está ausente o es incorrecto (con formato válido), el servidor procesa en **Modo Público**, devolviendo un **200 OK** (Si los servicios críticos están UP) pero omitiendo `performance` y `dependencies`.
    *   **Validación Estricta de Cabecera:** El `X-Health-Key` debe validarse mediante el Regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`. Formato inválido = 400.

### 🎨 Sección Frontend (The Consumer)

*   **Contrato de Mocks:**
    *   **Respuesta Privada (Success Full):**
        ```json
        {
          "status": "success",
          "version": "1.0.0",
          "timestamp": "2026-04-11T20:00:00.000Z",
          "performance": {
            "api_latency_ms": 45.00,
            "latency_type": "Server-side processing"
          },
          "dependencies": {
            "database": "connected",
            "redis": "connected",
            "email_service": "config_valid",
            "captcha_service": "config_valid"
          }
        }
        ```
    *   **Respuesta Pública (Success Limited):**
        ```json
        {
          "status": "success",
          "version": "1.0.0",
          "timestamp": "2026-04-11T20:01:00.000Z"
        }
        ```

    *   **Error 503 (Mock):**
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "2026-04-11T20:02:00.000Z",
          "error_code": "SYSTEM_DEGRADED",
          "message": "Servicios críticos no disponibles.",
          "unhealthy_services": ["database"]
        }
        ```

*   **Manejo de Estados UI:**
    *   **Idle:** Pantalla de "Initializing System...".
    *   **Loading:** Skeleton loaders para los 3 indicadores de dependencias.
    *   **Error:** Mostrar banner persistente con el `error_code` y botón de reintento con backoff exponencial.
    *   **Success (Healthy):** Dashboard con indicadores en verde y el valor de `api_latency_ms` destacado.
    *   **Success (Partial/Degraded):** Dashboard con indicadores correspondientes (rojo para servicios `disconnected`/`error`) y banner superior de "SLA compromised (Check Non-Critical Services)".

*   **Definición de Tipos (TypeScript):**
    ```typescript
    export type ConnectionStatus = 'connected' | 'disconnected';
    export type ConfigStatus = 'config_valid' | 'error';
    export type ServiceName = 'database' | 'redis' | 'email_service' | 'captcha_service';

    export type HealthCheckResponse = 
      | {
          status: 'success';
          version: string;
          timestamp: string;
          /* Definido solo si se detectó modo privado (X-Health-Key válida) */
          performance?: {
            api_latency_ms: number;
            latency_type: string;
          };
          dependencies?: {
            database: ConnectionStatus;
            redis: ConnectionStatus;
            email_service: ConfigStatus;
            captcha_service: ConfigStatus;
          };
        }
      | {
          status: 'error';
          version: string;
          timestamp: string;
          error_code: 
            | 'MALFORMED_REQUEST' 
            | 'AUTH_REQUIRED' 
            | 'RATE_LIMIT_EXCEEDED' 
            | 'SYSTEM_DEGRADED'
            | 'CONTENT_TYPE_NOT_SUPPORTED'
            | 'METHOD_NOT_ALLOWED';
          message: string;
          unhealthy_services?: ServiceName[]; /* Solo bajo X-Health-Key */
          details?: string;
        };
    ```

---
---

## Iteración 2: Registro y Validación de Origen

### ⚙️ Sección Backend (The Provider)

*   **Definición de Endpoints:**
    *   **Registro de Usuario:**
        *   **Verbo:** `POST`
        *   **Ruta:** `/api/v1/auth/register`
        *   **Descripción:** Crea una cuenta en estado `UNVERIFIED` y dispara el envío del email de activación (**RF1**, **RNF1**, **RNF3**).
    *   **Verificación de Email:**
        *   **Verbo:** `POST`
        *   **Ruta:** `/api/v1/auth/verify`
        *   **Descripción:** Valida el token de activación y activa la cuenta (**RF1**, **RNF6**). El enlace del correo (GET) debe apuntar a una Landing Page en el Frontend, la cual disparará este `POST` mediante JS.
    *   **Reenvío de Verificación:**
        *   **Verbo:** `POST`
        *   **Ruta:** `/api/v1/auth/resend`
        *   **Descripción:** Genera un nuevo token de activación si el anterior expiró o no se recibió (Limitado por IP/Email).
    
    *   **SOP Global (Inheritance):** Todos los endpoints de esta iteración heredan el protocolo de error definido en la Iteración 1, incluyendo **503 (SYSTEM_DEGRADED)** para servicios críticos, **405 (METHOD_NOT_ALLOWED)** para verbos incorrectos y **406 (NOT_ACCEPTABLE)** para negociación de contenido (Header `Accept`). La API siempre validará la salud del sistema y la integridad de las cabeceras antes de procesar cualquier lógica de negocio.

*   **Plantilla de Link de Activación:**
    *   **Template:** `{{FRONTEND_URL}}/auth/verify?token={{UUID_V4}}`
    *   **Variable de Entorno:** El Backend debe utilizar la variable `APP_FRONTEND_URL` para construir el enlace inyectado en el correo.

*   **Esquema de Request (Register):**
    *   **Body (JSON):**
        ```json
        {
          "email": "user@example.com",
          "password": "Password123!", 
          "birthdate": "2000-01-01", /* ISO-8601 (YYYY-MM-DD) */
          "terms_accepted": true
        }
        ```
    *   **Reglas de Validación (Strict):**
        *   **Email:** 
            *   **Regex:** Compatible con RFC 5322 (Ej. `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`).
            *   **Límites:** `minLength: 5`, `maxLength: 254`.
        *   **Password (RNF1):** 
            *   **Regex:** `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,128}$`
            *   **Límites:** `minLength: 8`, `maxLength: 128` (Seguridad contra DoS por hashing).
            *   *Requisito:* 1 Mayus, 1 Minus, 1 Num, 1 Carácter Especial (Permite símbolos ASCII extendidos).
        *   **Age (RNF3):** 
            *   **Cálculo:** `Now_UTC - Birthdate_UTC >= 18 años`. Debe ignorar diferencias de zona horaria (Cálculo absoluto en UTC).
            *   **Límites:** `minDate: 1900-01-01` (Prevención de fechas anómalas/vampiros).
        *   **Terms:** Booleano `true` mandatorio (Campo `terms_accepted`).

    *   **Justificación:** Esta lógica previene la **enumeración de usuarios** (RNF de seguridad implícito). El atacante siempre recibe el mismo feedback visual de "Registro exitoso". 
        *   **Escenarios de Colisión:**
            *   **Cuenta Verificada:** El sistema devuelve 201 Created y envía un correo informativo (No activación).
            *   **Cuenta No Verificada (< 24h):** El sistema devuelve 201 Created, invalida el token anterior y envía un **nuevo enlace de activación**.
            *   **Email Purgado (Cooldown de 7 días):** Escenario preventivo para emails que han sido marcados con actividad maliciosa o tras una eliminación de cuenta (Lógica de soporte). El sistema devuelve un **201 Created** dummy. Internamente, enviará un correo informando sobre el bloqueo temporal, sin exponer el motivo exacto para evitar enumeración.
        *   **Seguridad de IDs:** En todos los escenarios de colisión (Verificado, No Verificado o Cooldown), el `user_id` devuelto en el JSON **debe ser un valor dummy (UUID v4 aleatorio)** para evitar la filtración de la existencia del registro real.

*   **Esquema de Response (Register):**
    *   **SOP Exception:** Este endpoint aplica un **Strict Rate Limit** de 5 intentos por IP/día, el cual tiene precedencia sobre el límite global de 10 req/min. Las cabeceras `X-RateLimit-*` reportarán este límite específico mientras sea el más restrictivo (menor valor en `Remaining`).
    *   **Headers:**
        *   `X-RateLimit-Limit`: 5
        *   `X-RateLimit-Remaining`: Peticiones restantes.
        *   `X-RateLimit-Reset`: Unix Epoch.
    *   **Success (201 Created):**
        *   **Headers:**
            *   `X-RateLimit-Limit`: 5
            *   `X-RateLimit-Remaining`: 4 (Ejemplo)
            *   `X-RateLimit-Reset`: 1713028800
        *   **Note:** El bloque `performance` solo se incluye si se proporciona `X-Health-Key` (Modo Privado).
        ```json
        {
          "status": "success",
          "version": "1.0.0",
          "timestamp": "2026-04-14T14:00:00.000Z",
          "message": "Registro exitoso. Se ha enviado un enlace de activación a su correo.",
          "data": {
            "user_id": "uuid-v4",
            "token_expires_at": "2026-04-14T14:00:00.000Z" /* Expiración del Token (Now + 24h) */
          }
        }
        ```
    *   **Errors:**
        *   `400 Bad Request`:
            *   `error_code: INVALID_EMAIL_FORMAT`: Formato de email no cumple RFC 5322.
            *   `error_code: INVALID_AGE`: Usuario menor de 18 años (**RNF3**).
            *   `error_code: WEAK_PASSWORD`: No cumple con los criterios de **RNF1**.
            *   `error_code: TERMS_NOT_ACCEPTED`: Checkbox de términos no marcado.
            *   `error_code: MALFORMED_REQUEST`: JSON de entrada inválido o campos obligatorios faltantes.
            *   **Mock Error (400):**
                ```json
                {
                  "status": "error",
                  "version": "1.0.0",
                  "timestamp": "ISO-8601",
                  "error_code": "INVALID_AGE",
                  "message": "Debes ser mayor de 18 años para registrarte."
                }
                ```
        *   `409 Conflict`: Obsoleto por política de privacidad. Se reserva para colisiones de ID inesperadas.
        *   `429 Too Many Requests`:
            *   `error_code: REGISTRATION_LIMIT_EXCEEDED`: Más de 5 intentos por IP/día.
            *   **Headers:** `Retry-After: <seconds>`, `X-RateLimit-*`
            *   **Mock Error (429):**
                ```json
                {
                  "status": "error",
                  "version": "1.0.0",
                  "timestamp": "ISO-8601",
                  "error_code": "REGISTRATION_LIMIT_EXCEEDED",
                  "message": "Límite de registros diarios excedido para esta IP."
                }
                ```
        *   `201 Created (Partial Success):`
            *   `warning_code: EMAIL_DISPATCH_FAILED`
            *   **Descripción:** Registro en DB exitoso, pero fallo inicial en el envío del correo. Siguiendo el **RNF6**, el sistema iniciará reintentos automáticos con backoff exponencial. Se notifica al usuario para transparencia, aunque no requiere acción inmediata.
            *   **Mock Response:**
                ```json
                {
                  "status": "success",
                  "version": "1.0.0",
                  "timestamp": "ISO-8601",
                  "warning_code": "EMAIL_DISPATCH_FAILED",
                  "message": "Registro completado. El sistema está procesando el envío de su correo de activación.",
                  "data": { "user_id": "uuid-v4", "token_expires_at": "..." }
                }
                ```

*   **Esquema de Request (Verify):**
    *   **Body (JSON):**
        ```json
        {
          "token": "uuid-v4"
        }
        ```
    *   **Reglas de Validación:** El `token` debe ser un **UUID v4** válido (Regex It1, L157).
    *   **Rate Limiting:** 10 req/min por IP. (Consistente con SOP global).
    *   **Lógica de Side-effect:** Solo se procesa el cambio de estado si el método es `POST`. Un `GET` accidental (ej. prefetch de correo) debe ser ignorado retornando un `405 Method Not Allowed`.
    *   **Security Guard:** Para mitigar filtrado en logs de infraestructura del Backend, el token se envía estrictamente en el **Body** del POST. El Frontend debe extraer el token del Query Param de la Landing Page (`?token=...`) y transaccionarlo exclusivamente via Body. El uso de Query Params para el token en esta ruta de API está prohibido.
    *   **Headers de Respuesta:** `X-RateLimit-*` (Limit: 10).

*   **Esquema de Request (Resend):**
    *   **Body (JSON):**
        ```json
        {
          "email": "user@example.com"
        }
        ```
    *   **Reglas de Validación:** Paridad total con campos de [Registro](#esquema-de-request-register) (Regex RFC 5322, longitud 5-254).
    *   **Rate Limiting:** 3 solicitudes por hora por IP/Email.
    *   **Headers de Respuesta:** `X-RateLimit-*` (Limit: 3).

*   **Esquema de Response (Resend):**
    *   **Success (200 OK):**
        ```json
        {
          "status": "success",
          "version": "1.0.0",
          "timestamp": "2026-04-14T14:10:00.000Z",
          "message": "Si el correo está registrado, recibirá un nuevo enlace de activación."
        }
        ```
    *   **Success (200 OK - Partial):**
        *   **warning_code:** `EMAIL_DISPATCH_FAILED`
        *   **Descripción:** Solicitud procesada, pero fallo en el envío inicial del correo. El sistema iniciará reintentos automáticos (RNF6).
    *   **Errors:**
        *   `400 Bad Request`: `error_code: INVALID_EMAIL_FORMAT`.
        *   `429 Too Many Requests`: `error_code: RESEND_LIMIT_EXCEEDED` (Superó 3/hr).
        *   **Nota de Privacidad:** El endpoint siempre devuelve 200 OK si el formato es válido, incluso si el email no existe, para evitar enumeración. 
        *   **Flujo Interno (Already Verified):** Si el email corresponde a una cuenta ya activa, el API responderá 200 OK pero el servidor enviará un correo informativo ("Su cuenta ya está activa") en lugar de un link de activación.

---

*   **Seguridad y Persistencia (Backend Specs):**
    *   **Hashing:** Las contraseñas deben procesarse obligatoriamente con **Argon2id**. 
        *   *Nota:* Si se utiliza Bcrypt, el servidor **DEBE** pre-hashear la contraseña con **SHA-256** antes de pasarla al algoritmo de hashing para evitar el truncamiento a 72 caracteres y preservar la integridad del límite de 128 (RNF1).
    *   **Tokens:** Almacenados en una tabla de `auth_tokens` con relación 1:1 con `user_id` y timestamp de expiración. 
        *   **Persistencia Segura (RNF1):** Los tokens deben almacenarse HASHEADOS en la DB (usando **SHA-256**) para prevenir la activación de cuentas en caso de filtración de la base de datos.
        *   **Normalización Crítica:** Antes de realizar el hashing y la comparación, el servidor **DEBE** convertir el token (UUID v4) a **lowercase** para evitar colisiones por distinción de caja.
        *   **Invalidación:** Al generar un nuevo token para el mismo usuario, el anterior debe ser invalidado inmediatamente.

*   **Esquema de Response (Verify):**
    *   **Success (200 OK):**
        ```json
        {
          "status": "success",
          "version": "1.0.0",
          "timestamp": "2026-04-14T14:05:00.000Z",
          "message": "Cuenta verificada exitosamente. Ya puede iniciar sesión."
        }
        ```
    *   **Errors:**
        *   `400 Bad Request`: `error_code: INVALID_TOKEN` (Token malformado o no existe).
        *   `409 Conflict`: `error_code: ALREADY_VERIFIED` (La cuenta ya ha sido verificada previamente).
        *   `410 Gone`: `error_code: EXPIRED_TOKEN` (Token caducado tras 24 horas).
        *   **Mock Error (410):**
            ```json
            {
              "status": "error",
              "version": "1.0.0",
              "timestamp": "ISO-8601",
              "error_code": "EXPIRED_TOKEN",
              "message": "Enlace de activación caducado. Por favor, solicite uno nuevo."
            }
            ```
        *   **Mock Error (409 - Already Verified):**
            ```json
            {
              "status": "error",
              "version": "1.0.0",
              "timestamp": "ISO-8601",
              "error_code": "ALREADY_VERIFIED",
              "message": "Esta cuenta ya se encuentra activa."
            }
            ```

    *   **Error 405 (Mock):**
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "METHOD_NOT_ALLOWED",
          "message": "Método no permitido. Use POST para esta acción."
        }
        ```

---

### 🎨 Sección Frontend (The Consumer)

*   **Contrato de Mocks:**
    *   **Registro Exitoso:**
        ```json
        {
          "status": "success",
          "version": "1.0.0",
          "timestamp": "2026-04-14T14:00:00.000Z",
          "message": "Registro exitoso. Se ha enviado un enlace de activación...",
          "data": { "user_id": "mock-uuid", "token_expires_at": "2026-04-14T14:00:00.000Z" }
        }
        ```
    *   **Error de Edad (Under 18):**
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "INVALID_AGE",
          "message": "Debes ser mayor de 18 años para registrarte."
        }
        ```
    *   **Error Correo en Uso (Deprecado por Privacidad):** El Mock 409 es reemplazado por la respuesta 201 Estándar según la política Safe Registry.
    *   **Verificación Exitosa (200 OK):**
        ```json
        {
          "status": "success",
          "version": "1.0.0",
          "timestamp": "2026-04-14T14:05:00.000Z",
          "message": "Cuenta verificada exitosamente. Ya puede iniciar sesión."
        }
        ```
    *   **Error Token Inválido (400 Bad Request):**
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "INVALID_TOKEN",
          "message": "Enlace de activación inválido o inexistente."
        }
        ```
    *   **Reenvío Exitoso:**
        ```json
        {
          "status": "success",
          "version": "1.0.0",
          "timestamp": "2026-04-14T14:10:00.000Z",
          "message": "Si el correo está registrado, recibirá un nuevo enlace de activación."
        }
        ```
    *   **Error Token Expirado (410):**
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "EXPIRED_TOKEN",
          "message": "Enlace de activación caducado tras 24 horas."
        }
        ```
    *   **Error Límite de Reenvío (429):**
        ```json
        {
          "status": "error",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "RESEND_LIMIT_EXCEEDED",
          "message": "Demasiadas solicitudes de reenvío. Intente en 1 hora."
        }
        ```

*   **Manejo de Estados UI:**
    *   **Formulario Registro:**
        *   **Idle:** Formulario habilitado, botón "Registrarse" deshabilitado hasta que `terms_accepted` sea true.
        *   **Validating:** Feedback visual inmediato en campos de password (Checklist de RNF1) y edad.
        *   **Submitting:** Botón deshabilitado con spinner.
        *   **Success:** Redirección a `/auth/verify-pending` con ilustración de "Check your email". (Agnóstico de si la cuenta es nueva o pre-existente).
        *   **Error:** Mostrar mensaje general de error (ej. "Revisa los datos ingresados o intenta más tarde"). Nunca filtrar si el correo ya existe.
    *   **Vista de Verificación (Landing del Email):**
        *   **Idle/Processing:** Spinner central mientras se llama al endpoint `/verify` (POST) con el token enviado en el Body.
        *   **Success:** Mensaje "¡Cuenta Activada!" y botón de "Ir al Login".
        *   **Error (Expired):** Mensaje de token caducado con botón destacado para disparar el flujo de "Reenviar Email".
        *   **Error (Generic):** Mensaje informativo de "Error en verificación" (Abarca Token Inválido o Error 500).
    *   **Flujo de Reenvío de Email:**
        *   **Submitting:** Botón deshabilitado para evitar spam.
        *   **Success:** Notificación "Email enviado (Si existe registro)" y bloqueo de botón por 60s. El mensaje debe ser genérico para evitar filtrado de identidad.

*   **Definición de Tipos (TypeScript):**
    ```typescript
    export interface RegisterRequest {
      email: string;
      password: string;
      birthdate: string;
      terms_accepted: boolean;
    }

    export type AuthErrorCode = 
      | 'INVALID_AGE' 
      | 'WEAK_PASSWORD' 
      | 'TERMS_NOT_ACCEPTED' 
      | 'MALFORMED_REQUEST'
      | 'REGISTRATION_LIMIT_EXCEEDED'
      | 'INVALID_TOKEN'
      | 'ALREADY_VERIFIED'
      | 'EXPIRED_TOKEN'
      | 'INVALID_EMAIL_FORMAT'
      | 'RESEND_LIMIT_EXCEEDED'
      | 'METHOD_NOT_ALLOWED'
      | 'SYSTEM_DEGRADED'
      | 'CONTENT_TYPE_NOT_SUPPORTED'
      | 'INTERNAL_SERVER_ERROR';

    export type AuthServerResponse = 
      | RegisterResponse
      | VerifyResponse
      | ResendResponse
      | AuthErrorResponse
      | MethodNotAllowedResponse;

    export interface BaseAuthResponse {
      status: 'success' | 'error';
      version: string;
      timestamp: string;
      performance?: { /* Metadata Privada: Solo bajo X-Health-Key */
        api_latency_ms: number;
        latency_type: string;
      };
      dependencies?: { /* Metadata Privada: Solo bajo X-Health-Key */
        database: ConnectionStatus;
        redis: ConnectionStatus;
        email_service: ConfigStatus;
        captcha_service: ConfigStatus;
      };
    }

    export interface RegisterResponse extends BaseAuthResponse {
      status: 'success';
      message: string;
      warning_code?: 'EMAIL_DISPATCH_FAILED'; // Caso 201 Parcial con notificación
      data: {
        user_id: string; // Puede ser dummy por privacidad
        token_expires_at: string;
      };
    }

    export interface VerifyResponse extends BaseAuthResponse {
      status: 'success';
      message: string;
    }

    export interface ResendResponse extends BaseAuthResponse {
      status: 'success';
      message: string;
      warning_code?: 'EMAIL_DISPATCH_FAILED';
    }

    export interface AuthErrorResponse extends BaseAuthResponse {
      status: 'error';
      error_code: AuthErrorCode;
      message: string;
    }

    export interface MethodNotAllowedResponse extends BaseAuthResponse {
      status: 'error';
      error_code: 'METHOD_NOT_ALLOWED';
      message: string;
    }

    ```

---

## 🌐 Protocolo de Internacionalización (I18N)
*   **Header:** `Accept-Language` (ISO 639-1).
*   **Localización:** El servidor solo soporta `es` (Español Latam) para cumplir con el alcance definido.
*   **Alcance:** Afecta únicamente al campo `message` de la respuesta JSON. Los `error_code` permanecen inmutables en inglés.

---
