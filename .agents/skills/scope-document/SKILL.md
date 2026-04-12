---
name: scope_document
description: Protocolo para la construcción, validacion y estructuracón de requerimientos técnicos y funcionales para la creación del documento `PROJECT_scope.md`. Su función principal es desafiar supuestos, eliminar ambigüedades y garantizar que el alcance sea técnica y financieramente viable antes de proceder al contrato (`Project_spec`).
---

## 🎯 0. Descripción y Propósito del Proyecto (Contextualización)
Antes de procesar requerimientos, el protocolo debe establecer la base del proyecto:
1.  **Visión General:** ¿Qué es el producto? (ej: "Una plataforma de gestión de usuarios").
2.  **Problema a Resolver:** ¿Cuál es el "dolor" o necesidad que justifica esta construcción?
3.  **Objetivo Principal:** ¿Cuál es el resultado final esperado para que el proyecto se considere exitoso?
4.  **Audiencia Objetiva:** ¿Quiénes son los usuarios finales?


## 🛠 I. Fase de Procesamiento de Entrada (Input Analysis)

Por cada input del usuario, el protocolo ejecutará los siguientes hilos de procesamiento:

1.  **Extracción de Requerimientos Funcionales (RF):** Identificar acciones atómicas del sistema.
2.  **Mapeo de Requerimientos No Funcionales (RNF):** Identificar restricciones de calidad (Seguridad, Latencia, Carga, etc.).
3.  **Detección de Ambigüedades:** Escaneo de términos subjetivos. Si se detectan, el protocolo **detiene** la actualización y dispara un error de validación.

---

## ⚖️ II. Lógica de Contradicción (Devil's Advocate Logic)

Antes de validar cualquier requerimiento, el protocolo aplica:

-  **Regla de Negación:** ¿Qué sucede si el sistema NO realiza esta acción?
-  **Regla de Borde (Edge Case):** Forzar escenarios de error o abuso para cada RF.
-  **Regla de Cuantificación:** Convertir adjetivos en métricas técnicas (ej: "Rápido" -> "< 200ms").

---

## 📑 III. Estructuración de Salida (Standard Output)

El protocolo generará obligatoriamente estos bloques en cada interacción:

### 1. Resumen de Consolidación (Sync)
Estado actual de los puntos validados.

### 2. Definición de RF (User Stories)
Formato: `Como [X] + Quiero [Y] + Para [Z]`. 
*Incluye Criterios de Aceptación en formato Gherkin.*

### 3. Matriz de RNF (Quality Metrics)
Asociación de cada RF con métricas de rendimiento, seguridad y disponibilidad.

### 4. Gobernanza de Alcance (`audits/governance/scope_token.md`)
Actualización del estatus del token de autorización.
- `STATUS: BLOQUEADO (🔴)` -> Existen vacíos lógicos o falta de métricas.
- `STATUS: AUTORIZADO (🟢)` -> No existen ambigüedades.

### 5. Disparo de Interrogatorio (Pressure Test)
Preguntas de control basadas en los vacíos detectados.


## 🔏 IV. Restricciones de Soberanía y Rutas (Storage Guard)

1.  **Ruta Obligatoria:** El archivo final de alcance DEBE residir en:  
    `docs/governance/PROJECT_scope.md`
2.  **Ruta de Auditoría:** El token de gobernanza DEBE residir en:  
    `audits/governance/scope_token.md`
3.  **Escritura Bloqueada:** El protocolo tiene prohibido modificar los archivos en `docs/governance/` de forma autónoma. Solo se ejecutará tras la instrucción explícita del usuario.
4.  **Integridad:** No se permite avanzar al Requerimiento B si el Requerimiento A tiene un estatus `BLOQUEADO`.


## ✅ V. Auditoría de Cierre (Final Check)

El protocolo solo sugerirá el cierre del alcance si:
- [ ] ¿Todos los RF tienen criterios de aceptación?
- [ ] ¿Existen RNF definidos para Seguridad y Rendimiento?
- [ ] ¿Se ha definido la sección "Fuera de Alcance" (Out of Scope)?
- [ ] ¿Los archivos están correctamente direccionados a `docs/governance/`?