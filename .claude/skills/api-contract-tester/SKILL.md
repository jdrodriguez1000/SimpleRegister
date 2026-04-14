---
name: api-contract-tester
description: Validación de esquemas, JSON y formatos contractuales. Asegura que la comunicación entre sistemas sea 1:1 con la PROJECT_spec.md, protegiendo la integridad de los tipos de datos.
user-invocable: false
agent: backend-tester
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

## 📋 I. Protocolo de Validación Strict (No-Excess)

Toda validación de contrato debe fallar (RECHAZAR) si ocurre alguna de estas condiciones:
1. **Falta un Campo:** Cualquier campo marcado como obligatorio en la Spec debe estar presente.
2. **Tipo Incorrecto:** Si se espera un `number` y llega un `string` o un `float` cuando se espera `int`.
3. **Campos Extra:** **REGLA DE ORO:** No se permiten campos extra en la respuesta que no estén documentados en la Spec.
4. **Formato Inválido:** Fallar si el contenido no cumple con los estándares definidos abajo.

## 📏 II. Estándares de Formato (The Spec-Watch)

El agente debe verificar rigurosamente los siguientes patrones:

- **UUID v4:** Debe cumplir el Regex estricto: `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`.
- **Fechas (ISO-8601):** Debe incluir milisegundos y zona horaria (UTC recomendado): `YYYY-MM-DDTHH:mm:ss.sssZ`.
- **Latencia:** Debe ser un `float` con máximo 2 decimales (ej. `14.52`).
- **Nomenclatura (JSON):** Siempre usar `snake_case` o `camelCase` de forma consistente según el estándar del proyecto (ver `CLAUDE.md`).

## 🧪 III. Testing de Casos de Error (Edges)

No solo se prueban los éxitos (2xx); el tester debe certificar que los errores envían el payload correcto:
- **400 Bad Request:** Estructura de error coherente (ej: `error: "invalid_uuid"`).
- **429 Too Many Requests:** Verificación de que el Rate Limit se activa y devuelve el header `Retry-After`.
- **503 System Degraded:** Verificación de fallback parcial cuando Redis o la DB fallan.

## 📜 IV. Herramientas Recomendadas
Para la ejecución, el agente debe proferir el uso de:
- **Zod:** Para validación de esquemas en el código de backend.
- **Ajv (JSON Schema):** Para validación de payloads en tests de integración.
- **Supertest / Axios:** Para la ejecución de las peticiones de prueba.

---

> **Check de Certificación:**
> - [ ] He validado que los UUIDs pasan el regex v4.
> - [ ] He verificado que no hay "campos fantasma" en el JSON.
> - [ ] He probado que el API falla con un 400 ante un input malformado.
