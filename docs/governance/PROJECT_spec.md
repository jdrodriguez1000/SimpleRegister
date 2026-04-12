# PROJECT SPEC: SimpleRegister (Contratos Técnicos)

Este documento define las interfaces de comunicación entre el Backend y el Frontend, asegurando la integridad de los datos y el cumplimiento de los RNF desde la primera línea de código.

---

## Configuración Global (Iteración 1)

*   **URL Base (Development):** `http://localhost:3000`
*   **Protocolo CORS:**
    *   **Allowed Origins:** `http://localhost:5173` (Vite Default)
    *   **Allowed Methods:** `GET`, `OPTIONS`
    *   **Allowed Headers:** `Accept`, `Content-Type`, `X-Health-Key`
    *   **Exposed Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`

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
          "status": "healthy",
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
          "status": "unhealthy",
          "version": "1.0.0",
          "timestamp": "ISO-8601",
          "error_code": "MALFORMED_REQUEST",
          "message": "Formato de X-Health-Key inválido (Debe ser UUID v4)."
        }
        ```
    *   **Errors (403 Forbidden - Llave Incorrecta):**
        ```json
        {
          "status": "unhealthy",
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
          "status": "unhealthy",
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
          "status": "unhealthy",
          "version": "1.0.0",
          "timestamp": "2026-04-11T20:00:00.000Z",
          "error_code": "CONTENT_TYPE_NOT_SUPPORTED",
          "message": "Sólo se soporta respuesta en formato JSON."
        }
        ```

    *   **Errors (503 Service Unavailable - Fallo Crítico):**
        *   **Disparador:** `database` o `redis` en estado `disconnected`.
        ```json
        {
          "status": "unhealthy",
          "version": "1.0.0",
          "timestamp": "2026-04-11T20:00:00.000Z",
          "error_code": "SYSTEM_DEGRADED",
          "message": "Servicios críticos no disponibles.",
          "unhealthy_services": ["database", "redis"]
        }
        ```

    *   **Protocolo de Error (SOP):** Para garantizar el cumplimiento de **RNF5**, toda respuesta (2xx, 4xx, 5xx) debe incluir los campos `version` y `timestamp`. Los headers `X-RateLimit-*` se incluyen incluso en respuestas de error 4xx/5xx si aplican para la IP.
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
          "status": "healthy",
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
          "status": "healthy",
          "version": "1.0.0",
          "timestamp": "2026-04-11T20:01:00.000Z"
        }
        ```

    *   **Error 503 (Mock):**
        ```json
        {
          "status": "unhealthy",
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
          status: 'healthy';
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
          status: 'unhealthy';
          version: string;
          timestamp: string;
          error_code: 
            | 'MALFORMED_REQUEST' 
            | 'AUTH_REQUIRED' 
            | 'RATE_LIMIT_EXCEEDED' 
            | 'SYSTEM_DEGRADED'
            | 'CONTENT_TYPE_NOT_SUPPORTED';
          message: string;
          unhealthy_services?: ServiceName[];
          details?: string;
        };
    ```

---
