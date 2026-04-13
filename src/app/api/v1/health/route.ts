/**
 * route.ts — Endpoint GET /api/v1/health
 * Trazabilidad: TSK-I1-B03-G / TSK-I1-B03-RF — PROJECT_spec.md [Iteracion 1]
 * Agente: backend-coder
 *
 * Responsabilidad: controlador delgado. Coordina en orden:
 *   1. Negociacion de contenido (Accept header → 406)
 *   2. Validacion del X-Health-Key (UUID v4 → modo publico o privado)
 *   3. Rate Limiting (solo modo publico) via checkRateLimit → 429 | 503 Fail-Closed
 *   4. Health Check via runHealthCheckWithFallback (interceptor de errores) → 503
 *   5. Construccion de respuesta via sop_response helpers
 *   6. Aplicacion de headers CORS y X-RateLimit-* (modo publico)
 *
 * B03-G: Agrega logica de Rate Limit (Fixed Window, Redis) y Fail-Closed (RNF9).
 * B03-RF: Introduce runHealthCheckWithFallback como interceptor de errores centralizado.
 *         Extrae extractClientIp y applyRateLimitHeaders como helpers de responsabilidad unica.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { validateUUIDv4Header } from '@/src/lib/validators/health_validators';
import { runHealthCheck } from '@/src/lib/services/health_service';
import type { HealthCheckResult } from '@/src/lib/services/health_service';
import { checkRateLimit } from '@/src/lib/middleware/rate_limit';
import type { RateLimitResult } from '@/src/lib/middleware/rate_limit';
import {
  buildPublicSuccessResponse,
  buildPrivateSuccessResponse,
  buildErrorResponse,
  formatLatency,
  type ServiceName,
} from '@/src/lib/helpers/sop_response';

// =============================================================================
// Configuracion CORS — PROJECT_spec.md "Protocolo CORS"
// =============================================================================

const CORS_ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN ?? 'http://localhost:5173';

function applyCorsHeaders(res: NextResponse, origin: string | null): void {
  const allowedOrigin = origin === CORS_ALLOWED_ORIGIN ? origin : '';
  if (allowedOrigin) {
    res.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type, X-Health-Key');
    res.headers.set(
      'Access-Control-Expose-Headers',
      'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After'
    );
  }
}

// =============================================================================
// Helpers de Rate Limit (B03-RF — responsabilidad unica)
// =============================================================================

/**
 * Extrae la IP real del cliente desde headers HTTP estandar.
 * Prioridad: x-forwarded-for (proxy / Docker) → x-real-ip → fallback 'unknown'.
 * No usa req.ip: no esta disponible en el runtime Node.js de Next.js.
 */
function extractClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

/**
 * Aplica los headers X-RateLimit-* a una respuesta existente.
 * Spec: "Exposed Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset"
 * Se incluyen en respuestas 2xx y 4xx/5xx cuando aplican para la IP (modo publico).
 */
function applyRateLimitHeaders(res: NextResponse, result: RateLimitResult): void {
  res.headers.set('X-RateLimit-Limit', String(result.limit));
  res.headers.set('X-RateLimit-Remaining', String(result.remaining));
  res.headers.set('X-RateLimit-Reset', String(result.resetAt));
}

// =============================================================================
// Interceptor de errores del Health Check (B03-RF — patron fallback centralizado)
// =============================================================================

/**
 * Ejecuta runHealthCheck() envuelto en un interceptor de errores.
 * Si el servicio de salud lanza una excepcion (ej. pool de conexiones agotado),
 * el interceptor muta el resultado a un estado de degradacion critica total,
 * evitando que el controlador reciba una excepcion no manejada.
 *
 * Esto garantiza que el endpoint SIEMPRE retorne JSON valido (RNF5),
 * incluso ante fallos catasfroficos del servicio de verificacion.
 */
async function runHealthCheckWithFallback(): Promise<HealthCheckResult> {
  try {
    return await runHealthCheck();
  } catch {
    // Interceptor: excepcion capturada → resultado degradado critico total
    return {
      dependencies: {
        database: 'disconnected',
        redis: 'disconnected',
        email_service: 'error',
        captcha_service: 'error',
      },
      hasCriticalFailure: true,
      unhealthyServices: ['database', 'redis'],
    };
  }
}

// =============================================================================
// Handler OPTIONS (preflight CORS)
// =============================================================================

export function OPTIONS(req: NextRequest): NextResponse {
  const origin = req.headers.get('origin');
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(res, origin);
  return res;
}

// =============================================================================
// Handler GET
// =============================================================================

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestStart = performance.now();
  const origin = req.headers.get('origin');

  // --- 1. Negociacion de Contenido (HTTP 406) ---
  const acceptHeader = req.headers.get('accept');
  if (
    acceptHeader !== null &&
    acceptHeader !== '' &&
    !acceptHeader.includes('application/json') &&
    !acceptHeader.includes('*/*')
  ) {
    const body = buildErrorResponse(
      'CONTENT_TYPE_NOT_SUPPORTED',
      'Sólo se soporta respuesta en formato JSON.'
    );
    const res = NextResponse.json(body, { status: 406 });
    applyCorsHeaders(res, origin);
    return res;
  }

  // --- 2. Validacion del X-Health-Key ---
  const rawKey = req.headers.get('x-health-key');
  let isPrivateMode = false;

  if (rawKey !== null) {
    if (!validateUUIDv4Header(rawKey)) {
      const body = buildErrorResponse(
        'MALFORMED_REQUEST',
        'Formato de X-Health-Key inválido (Debe ser UUID v4).'
      );
      const res = NextResponse.json(body, { status: 400 });
      applyCorsHeaders(res, origin);
      return res;
    }

    const configuredKey = process.env.X_HEALTH_KEY;
    if (configuredKey && rawKey.toLowerCase() === configuredKey.toLowerCase()) {
      isPrivateMode = true;
    }
  }

  // --- 3. Rate Limiting (solo modo publico — acceso privado exento) ---
  // Spec: "Rate Limiting: 10 req/min por IP. Acceso Privado: Exento de Rate Limit."
  // RNF9: "Si el sistema de cache falla, el acceso debe bloquearse por defecto."
  let rateLimitResult: RateLimitResult | null = null;

  if (!isPrivateMode) {
    const clientIp = extractClientIp(req);
    rateLimitResult = await checkRateLimit(clientIp);

    if (rateLimitResult.failReason === 'CACHE_UNAVAILABLE') {
      // RNF9 Fail-Closed: Redis no disponible para rate limiting.
      // Ejecutar health check para obtener el panorama completo de servicios caidos,
      // asegurandonos de incluir 'redis' dado que fallo la verificacion de rate limit.
      const healthResult = await runHealthCheckWithFallback();
      const unhealthySet = new Set([...healthResult.unhealthyServices, 'redis']);
      const mergedUnhealthy = Array.from(unhealthySet);

      const body = buildErrorResponse(
        'SYSTEM_DEGRADED',
        'Servicios críticos no disponibles.',
        mergedUnhealthy as ServiceName[]
      );
      const res = NextResponse.json(body, { status: 503 });
      applyCorsHeaders(res, origin);
      return res;
    }

    if (!rateLimitResult.allowed) {
      // HTTP 429: limite de ventana agotado para esta IP
      const body = buildErrorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Demasiadas peticiones. Límite de 10 req/min excedido.'
      );
      const res = NextResponse.json(body, { status: 429 });
      applyRateLimitHeaders(res, rateLimitResult);
      if (rateLimitResult.retryAfter !== undefined) {
        res.headers.set('Retry-After', String(rateLimitResult.retryAfter));
      }
      applyCorsHeaders(res, origin);
      return res;
    }
  }

  // --- 4. Verificacion de servicios (modo privado: payload completo) ---
  if (isPrivateMode) {
    const result = await runHealthCheckWithFallback();

    if (result.hasCriticalFailure) {
      const body = buildErrorResponse(
        'SYSTEM_DEGRADED',
        'Servicios críticos no disponibles.',
        result.unhealthyServices as ServiceName[]
      );
      const res = NextResponse.json(body, { status: 503 });
      applyCorsHeaders(res, origin);
      return res;
    }

    const latencyMs = formatLatency(performance.now() - requestStart);
    const body = buildPrivateSuccessResponse(latencyMs, result.dependencies);
    const res = NextResponse.json(body, { status: 200 });
    applyCorsHeaders(res, origin);
    return res;
  }

  // --- 5. Verificacion de servicios (modo publico: payload minimo) ---
  const quickCheck = await runHealthCheckWithFallback();

  if (quickCheck.hasCriticalFailure) {
    const body = buildErrorResponse(
      'SYSTEM_DEGRADED',
      'Servicios críticos no disponibles.',
      quickCheck.unhealthyServices as ServiceName[]
    );
    const res = NextResponse.json(body, { status: 503 });
    // Rate limit headers aplican incluso en 4xx/5xx (spec)
    if (rateLimitResult) applyRateLimitHeaders(res, rateLimitResult);
    applyCorsHeaders(res, origin);
    return res;
  }

  // --- 6. Respuesta publica exitosa ---
  const body = buildPublicSuccessResponse();
  const res = NextResponse.json(body, { status: 200 });
  if (rateLimitResult) applyRateLimitHeaders(res, rateLimitResult);
  applyCorsHeaders(res, origin);
  return res;
}
