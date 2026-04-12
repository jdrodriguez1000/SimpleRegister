---
name: spec-document
descripcion: Protocolo de diseño de contratos técnicos para la generación y expansión incremental del documento `PROJECT_spec.md`. Este protocolo actúa como el "Traductor Universal" entre los objetivos de la iteración y la implementación técnica, definiendo con precisión quirúrgica el intercambio de datos entre el Backend (Proveedor) y el Frontend (Consumidor).
---

## 🔍 I. Sincronización con la Iteración (Iterative Sync)
El protocolo opera bajo el principio de **Just-in-Time Documentation**. No se especifica nada que no pertenezca a la iteración activa:
1.  **Identificación de Targets:** Mapear los **RF/RNF** de la iteración actual en `PROJECT_plan.md` que requieren interfaz.
2.  **Consistencia Arquitectónica:** Validar que los modelos de datos respetan los patrones (ej. Inyección de dependencias, tipos de datos) de `PROJECT_architecture.md`.
3.  **Estado de Pre-requisitos:** El protocolo se activa solo si `plan_token.md` está en estado `AUTORIZADO (🟢)`.

---

## ⚖️ II. Lógica de Contradicción del Contrato (Interface Devil's Advocate)
Antes de consolidar la especificación, el protocolo somete la interfaz a pruebas de estrés lógico:
- **Regla de la Respuesta Fallida:** ¿Existe un código de error específico para cada fallo posible (ej. 409 Conflict si el email ya existe)?
- **Regla de Integridad de Tipos:** ¿Están definidos los rangos, longitudes y formatos (Regex) de cada campo de entrada?
- **Regla de Eficiencia (Payload):** ¿Se están enviando solo los datos necesarios para el requerimiento o hay sobrecarga de información?

---

## 📑 III. Estructuración de Salida Dual (Standard Output)
El documento `docs/governance/PROJECT_spec.md` se expandirá iteración a iteración con el siguiente esquema:

### ### [Nombre de la Iteración]: Especificaciones Técnicas

#### ⚙️ Sección Backend (The Provider)
* **Definición de Endpoints:** Verbos HTTP, Rutas y Versionamiento.
* **Esquema de Request:** Body (JSON Schema), Query Params y Headers de seguridad.
* **Esquema de Response:**
    * **Success (2xx):** Estructura del objeto de éxito.
    * **Errors (4xx/5xx):** Catálogo de errores con mensajes y códigos internos.
* **Reglas de Validación:** Restricciones de negocio aplicadas al esquema.

#### 🎨 Sección Frontend (The Consumer)
* **Contrato de Mocks:** Ejemplo exacto del JSON para desarrollo offline/paralelo.
* **Manejo de Estados UI:** Definición de estados (Idle, Loading, Error, Success).
* **Definición de Tipos (TypeScript):** Interfaces y Types necesarios para el consumo de datos.

---

## 🔏 IV. Restricciones de Soberanía y Rutas (Storage Guard)
1.  **Ruta del Documento:** `docs/governance/PROJECT_spec.md`
2.  **Ruta del Token:** `audits/governance/spec_token.md`
3.  **Naturaleza Evolutiva:** El protocolo **anexa** contenido. Está prohibido borrar especificaciones de iteraciones pasadas sin un proceso de "Gestión de Cambios" previo.
4.  **Soberanía:** Requiere instrucción explícita: "Expandir especificación para Iteración [N]".

---

## ✅ V. Auditoría de Cierre (Spec Final Check)
- [ ] ¿La especificación permite generar un Mock funcional inmediatamente?
- [ ] ¿Se han definido los casos de error para cada validación de negocio?
- [ ] ¿El naming convention (camelCase/snake_case) es consistente en toda la Spec?
- [ ] ¿Están definidos los headers de autenticación si el endpoint es protegido?