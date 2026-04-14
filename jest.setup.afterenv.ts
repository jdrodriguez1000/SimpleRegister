/**
 * jest.setup.afterenv.ts — Inicialización del entorno de test (afterEnv)
 * Trazabilidad: TSK-I2-B02-RF — Test isolation para rate limiter in-memory
 * Agente: backend-coder
 *
 * Objetivo: garantizar aislamiento entre bloques it() para el store in-memory
 * del rate limiter de registro. Sin este reset, el estado acumulado entre tests
 * de un mismo archivo puede provocar falsos positivos/negativos en las pruebas
 * de rate limiting y en tests que usan la misma IP de referencia (TEST_IP).
 *
 * Comportamiento:
 *   - beforeEach: limpia el store in-memory del register_rate_limiter
 *   - NO afecta tests que no usan el rate limiter (todos los tests de i1)
 */

import { __resetInMemoryStore__ } from '@/src/lib/middleware/register_rate_limiter';

beforeEach(() => {
  __resetInMemoryStore__();
});
