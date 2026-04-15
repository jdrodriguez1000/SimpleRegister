/**
 * route.ts — POST /api/v1/auth/register
 * Trazabilidad: TSK-I2-B11 (Pre-requisite)
 *
 * Responsabilidad: Exponer el servicio de registro via HTTP.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { registerUser, type RegisterRequest } from '@/src/lib/services/register_service';
import { drizzleUserRepository } from '@/src/lib/db/repositories/user_repository';

// --- Helpers locales (alineados con pattern de health/route.ts) ---

function extractClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

const CORS_ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN ?? 'http://localhost:5173';

function applyCorsHeaders(res: NextResponse, origin: string | null): void {
  const allowedOrigin = origin === CORS_ALLOWED_ORIGIN ? origin : '';
  if (allowedOrigin) {
    res.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
    res.headers.set(
      'Access-Control-Expose-Headers',
      'X-Request-ID, X-Version, X-Timestamp, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After'
    );
  }
}

// --- Handler OPTIONS (Preflight) ---

export function OPTIONS(req: NextRequest): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(res, req.headers.get('origin'));
  return res;
}

// --- Handler POST ---

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const clientIp = extractClientIp(req);

  try {
    // 1. Validar Negociación de Contenido
    const acceptHeader = req.headers.get('accept');
    if (
      acceptHeader !== null &&
      acceptHeader !== '' &&
      !acceptHeader.includes('application/json') &&
      !acceptHeader.includes('*/*')
    ) {
      const res = NextResponse.json({
        status: 'error',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        error_code: 'CONTENT_TYPE_NOT_SUPPORTED',
        message: 'Sólo se soporta respuesta en formato JSON.'
      }, { status: 406 });
      applyCorsHeaders(res, origin);
      return res;
    }

    // 2. Parsear Body
    const body = await req.json() as RegisterRequest;

    // 3. Invocar Caso de Uso (Inyección de repositorio real)
    const result = await registerUser(
      body, 
      { ip: clientIp },
      undefined, // Rate limiter default
      drizzleUserRepository
    );

    // 4. Construir Respuesta SOP
    const res = NextResponse.json(result.body, { status: result.statusCode });
    
    // Inyectar headers devueltos por el service (SOP + Rate Limit)
    Object.entries(result.headers).forEach(([key, value]) => {
      res.headers.set(key, value as string);
    });

    applyCorsHeaders(res, origin);
    return res;

  } catch (error) {
    // Si falla el parseo o hay error inesperado
    const res = NextResponse.json({
      status: 'error',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error_code: 'MALFORMED_REQUEST',
      message: 'La solicitud contiene datos inválidos o incompletos.'
    }, { status: 400 });
    applyCorsHeaders(res, origin);
    return res;
  }
}
