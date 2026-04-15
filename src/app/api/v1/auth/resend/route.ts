/**
 * route.ts — POST /api/v1/auth/resend
 * Trazabilidad: TSK-I2-B11 (Pre-requisite)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { resendVerification, type ResendRequest } from '@/src/lib/services/resend_service';

// --- Helpers locales ---

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

// --- Handler OPTIONS ---

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
    const body = await req.json() as ResendRequest;
    
    // Invocar Caso de Uso
    const result = await resendVerification(body, { ip: clientIp });

    const res = NextResponse.json(result.body, { status: result.statusCode });
    
    Object.entries(result.headers).forEach(([key, value]) => {
      res.headers.set(key, value as string);
    });

    applyCorsHeaders(res, origin);
    return res;

  } catch (error) {
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
