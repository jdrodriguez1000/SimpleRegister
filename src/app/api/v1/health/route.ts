/**
 * route.ts — Endpoint GET /api/v1/health
 * Trazabilidad: TSK-I1-B02-G — PROJECT_spec.md [Iteracion 1]
 * Agente: backend-coder
 *
 * Responsabilidad: controlador delgado. Solo coordina:
 *   1. Negociacion de contenido (Accept header)
 *   2. Validacion del X-Health-Key
 *   3. Delegacion al health_service
 *   4. Construccion de respuesta via sop_response helpers
 *   5. Aplicacion de headers CORS y Rate-Limit
 *
 * NO contiene logica de negocio ni logica de validacion UUID en linea.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { validateUUIDv4Header } from '@/src/lib/validators/health_validators';
import { runHealthCheck } from '@/src/lib/services/health_service';
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
    // Header presente: debe ser UUID v4 valido o responder 400
    if (!validateUUIDv4Header(rawKey)) {
      const body = buildErrorResponse(
        'MALFORMED_REQUEST',
        'Formato de X-Health-Key inválido (Debe ser UUID v4).'
      );
      const res = NextResponse.json(body, { status: 400 });
      applyCorsHeaders(res, origin);
      return res;
    }

    // UUID valido: verificar contra el secreto configurado
    const configuredKey = process.env.X_HEALTH_KEY;
    if (configuredKey && rawKey.toLowerCase() === configuredKey.toLowerCase()) {
      isPrivateMode = true;
    }
    // Si es UUID valido pero incorrecto → modo publico (no 403 hasta que el bloque lo requiera)
    // Spec: "Si el header es incorrecto (con formato valido), el servidor procesa en Modo Publico"
  }

  // --- 3. Verificacion de servicios (solo en modo privado o siempre para 503) ---
  if (isPrivateMode) {
    const result = await runHealthCheck();

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

  // --- 4. Modo publico: verificacion minima de servicios criticos para 503 ---
  // El modo publico tambien debe retornar 503 si los servicios criticos estan caidos
  const quickCheck = await runHealthCheck();
  if (quickCheck.hasCriticalFailure) {
    const body = buildErrorResponse(
      'SYSTEM_DEGRADED',
      'Servicios críticos no disponibles.',
      quickCheck.unhealthyServices as ServiceName[]
    );
    const res = NextResponse.json(body, { status: 503 });
    applyCorsHeaders(res, origin);
    return res;
  }

  // --- 5. Respuesta publica exitosa ---
  const body = buildPublicSuccessResponse();
  const res = NextResponse.json(body, { status: 200 });
  applyCorsHeaders(res, origin);
  return res;
}
