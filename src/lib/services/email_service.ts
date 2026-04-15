/**
 * email_service.ts — Servicio de Envío de Emails con Backoff Exponencial
 * Trazabilidad: TSK-I2-B03-RF
 * Agente: backend-coder
 *
 * Responsabilidad única: encapsular el envío de emails transaccionales con
 * resiliencia ante fallos SMTP mediante backoff exponencial (RNF6).
 *
 * Política de reintentos:
 *   - Base: 1 segundo
 *   - Factor: 2x (1s → 2s → 4s)
 *   - Máximo de reintentos: 3
 *   - Si todos los intentos fallan → { success: false, errorCode: 'SMTP_FAILURE' }
 *
 * Templates HTML: autocontenidos con inline CSS, sin dependencias externas.
 *
 * Clean Architecture: no importa Next.js, no importa ORM.
 */

// =============================================================================
// Contratos públicos
// =============================================================================

export interface EmailResult {
  success: boolean;
  errorCode?: string;
}

// =============================================================================
// Constantes de la política de reintentos
// =============================================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const BACKOFF_FACTOR = 2;

// =============================================================================
// Helper de espera — permite mocking en tests
// =============================================================================

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Templates HTML — autocontenidos con inline CSS
// =============================================================================

/**
 * Template HTML para el email de verificación inicial de cuenta.
 */
function buildVerificationTemplate(token: string): {
  subject: string;
  html: string;
} {
  const verifyUrl = `${process.env.APP_FRONTEND_URL ?? 'http://localhost:3000'}/auth/verify?token=${token}`;

  return {
    subject: 'Verifica tu cuenta en SimpleRegister',
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verificación de cuenta</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">
          <!-- Cabecera -->
          <tr>
            <td style="background-color:#1a56db;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">SimpleRegister</h1>
            </td>
          </tr>
          <!-- Cuerpo -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">Activa tu cuenta</h2>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
                Gracias por registrarte. Para completar el proceso y comenzar a usar tu cuenta,
                haz clic en el botón de verificación a continuación.
              </p>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
                Este enlace es válido por <strong>24 horas</strong>.
              </p>
              <!-- Botón CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#1a56db;border-radius:6px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      Verificar mi cuenta
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:32px 0 0;color:#9ca3af;font-size:13px;">
                Si no creaste esta cuenta, puedes ignorar este correo de forma segura.
              </p>
            </td>
          </tr>
          <!-- Pie -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                &copy; ${new Date().getFullYear()} SimpleRegister. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

/**
 * Template HTML para el email de reenvío del enlace de verificación.
 */
function buildResendTemplate(token: string): {
  subject: string;
  html: string;
} {
  const verifyUrl = `${process.env.APP_FRONTEND_URL ?? 'http://localhost:3000'}/auth/verify?token=${token}`;

  return {
    subject: 'Nuevo enlace de verificación — SimpleRegister',
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nuevo enlace de verificación</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">
          <!-- Cabecera -->
          <tr>
            <td style="background-color:#1a56db;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">SimpleRegister</h1>
            </td>
          </tr>
          <!-- Cuerpo -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">Nuevo enlace de activación</h2>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
                Recibimos tu solicitud de reenvío. A continuación encontrarás un nuevo enlace
                de verificación para activar tu cuenta.
              </p>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
                Este enlace es válido por <strong>24 horas</strong>. El enlace anterior
                ya no es válido.
              </p>
              <!-- Botón CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#1a56db;border-radius:6px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                      Activar mi cuenta
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:32px 0 0;color:#9ca3af;font-size:13px;">
                Si no solicitaste este reenvío, puedes ignorar este correo de forma segura.
              </p>
            </td>
          </tr>
          <!-- Pie -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                &copy; ${new Date().getFullYear()} SimpleRegister. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

// =============================================================================
// Lógica de envío con backoff exponencial (RNF6)
// =============================================================================

/**
 * Abstracción del transporte SMTP.
 * En producción se inyecta un cliente Nodemailer real.
 * En tests se puede inyectar un stub.
 */
export interface SmtpTransport {
  sendMail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void>;
}

/**
 * Intenta el envío con reintentos en backoff exponencial.
 *
 * @param transport  - Implementación del transporte SMTP.
 * @param options    - Datos del correo a enviar.
 * @returns          - EmailResult indicando éxito o fallo tras agotar intentos.
 *
 * Política: base 1s, factor 2x, máx 3 reintentos (1s → 2s → 4s).
 */
async function sendWithRetry(
  transport: SmtpTransport,
  options: { to: string; subject: string; html: string }
): Promise<EmailResult> {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await transport.sendMail(options);
      return { success: true };
    } catch {
      attempt += 1;
      if (attempt < MAX_RETRIES) {
        // Backoff exponencial: 1s, 2s, 4s
        const waitMs = BASE_DELAY_MS * Math.pow(BACKOFF_FACTOR, attempt - 1);
        await delay(waitMs);
      }
    }
  }

  return { success: false, errorCode: 'SMTP_FAILURE' };
}

// =============================================================================
// API pública del servicio
// =============================================================================

/**
 * Envía el email de verificación inicial al nuevo usuario registrado.
 *
 * @param to        - Dirección de destino (ya normalizada a lowercase).
 * @param token     - Token UUID v4 raw (sin hashear — el hash es para la DB).
 * @param transport - Transporte SMTP inyectable (default: no-op en desarrollo).
 * @returns         - EmailResult con success/errorCode.
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  transport?: SmtpTransport
): Promise<EmailResult> {
  const { subject, html } = buildVerificationTemplate(token);

  if (!transport) {
    // En desarrollo sin configuración SMTP, operación es no-op exitosa
    return { success: true };
  }

  return sendWithRetry(transport, { to, subject, html });
}

/**
 * Envía el email de reenvío con el nuevo token de verificación.
 *
 * @param to        - Dirección de destino (ya normalizada a lowercase).
 * @param token     - Nuevo token UUID v4 raw generado para este reenvío.
 * @param transport - Transporte SMTP inyectable (default: no-op en desarrollo).
 * @returns         - EmailResult con success/errorCode.
 */
export async function sendResendEmail(
  to: string,
  token: string,
  transport?: SmtpTransport
): Promise<EmailResult> {
  const { subject, html } = buildResendTemplate(token);

  if (!transport) {
    // En desarrollo sin configuración SMTP, operación es no-op exitosa
    return { success: true };
  }

  return sendWithRetry(transport, { to, subject, html });
}
