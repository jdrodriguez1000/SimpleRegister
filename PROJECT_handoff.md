# 🤝 Project Handoff — Bloque 3: Resiliencia y Rate Limiting (Etapa 1.3.0)

**Estado Actual:** Bloque 3 certificado. El sistema soporta rate limiting persistido en Redis y falla con gracia (SYSTEM_DEGRADED) ante caídas de infraestructura.
**Fecha de Corte:** 2026-04-12
**Próxima Sesión Objetivo:** Iniciar Bloque 4 (Dashboard de Salud: Estructura) y Bloque 5 (UI Logic & States).

---

## §1 Coordenadas de Ejecución

| Campo | Valor |
|---|---|
| **Iteración** | Iteración 1 — Cimientos y Performance Base |
| **Bloque Completado** | Bloque 3 — Resiliencia y Rate Limiting (Etapa 1.3.0) |
| **Bloque Siguiente** | Bloque 4 — Dashboard de Salud: Estructura (Etapa 1.4.0) |
| **Rama activa** | `feat/i1_b3_resilience` (lista para merge a `dev`) |
| **Agentes que actuaron** | `backend-tester`, `backend-coder`, `backend-reviewer` |
| **Capas impactadas** | Middlewares (Rate Limit), Redis Adapter, Fallback Layer |

---

## §2 Hitos de esta Sesión (Bloque 3)
- ✅ **TSK-I1-B03-R/V**: Suite de tests de resiliencia y carga. Validación de:
    - Límite de 10 peticiones/min para IPs públicas.
    - Bypass de rate limit mediante `X-Health-Key` válida.
    - Fallback `SYSTEM_DEGRADED` (503) ante caída de DB o Redis (Chaos tested).
- ✅ **TSK-I1-B03-G**: Implementación de middleware de Rate Limiting con persistencia en Redis.
- ✅ **TSK-I1-B03-C**: Certificación de performance: latencia media < 200ms bajo carga controlada.

---

## §3 Mapa Táctico de Continuidad

### ⚡ NEXT STEPS
1. **Merge B03:** Integrar `feat/i1_b3_resilience` en `dev`.
2. **Ciclo B04 (Frontend):** El `frontend-tester` debe ejecutar la validación de arquitectura Red (ausencia de envs/tipos).
3. **App Bootstrap:** El `frontend-coder` iniciará la creación del scaffold de Next.js 15.

---

## §4 Registro Histórico de Decisiones (Append-only ⚠️)

### [2026-04-12] — Sesión: Bloque 2 - Health API & SOP
- **Fricción:** La validación de UUIDv4 en Node.js requiere un Regex estricto para cumplir con el contrato de la Spec; el uso de librerías externas fue evitado para mantener el minimalismo.
- **Optimización:** La centralización de la lógica de latencia en un helper permite reutilizarla en futuros endpoints de la Iteración 2 (Auth/Register).

### [2026-04-12] — Sesión: Bloque 3 - Resiliencia y Rate Limiting
- **Decisión:** Se optó por un esquema de "Fixed Window" para el rate limit por simplicidad y bajo overhead en Redis, cumpliendo con los 10 req/min de la Spec.
- **Fricción:** El fallback `SYSTEM_DEGRADED` requirió un interceptor global de errores para asegurar que el payload JSON sea consistente incluso cuando la conexión a Redis falla (evitando el crash del proceso).
