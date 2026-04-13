/**
 * jest.setup.ts — Inicialización Global del Entorno de Test
 * Trazabilidad: TSK-I1-F01-RF — Configuración de Entorno para Tests Frontend
 *
 * Carga las variables NEXT_PUBLIC_* requeridas por los tests de arquitectura
 * frontend, dado que Jest no pasa por el runtime de Next.js (que carga .env
 * automáticamente).
 *
 * Nota: Solo se inyectan variables de configuración no sensibles (públicas).
 * Los secretos (X_HEALTH_KEY, DATABASE_URL, etc.) NO deben definirse aquí.
 */

// Variables de configuración pública requeridas por tests de arquitectura FE
// Espejo de .env.example — valores de desarrollo local
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';
