import { after } from 'next/server';

import { env } from '@/platform/config';
import { createLogger } from '@/platform/observability/logger';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { z } from '@/platform/validation/zod';
import { notifyWhatsAppMessages } from '@/modules/notifications/whatsapp-message-push';
import { storeWebhookBatch } from '@/modules/whatsapp/webhook-inbox';
import { parseWebhookPayload } from '@/modules/whatsapp/webhook-payload';
import { isValidVerifyToken, isValidWebhookSignature } from '@/modules/whatsapp/webhook-signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 256 * 1024;
const logger = createLogger('WhatsAppWebhookRoute');

const verificationSchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string().min(1).max(256),
  // Meta envia un entero; solo se devuelven digitos para no reflejar contenido arbitrario.
  'hub.challenge': z.string().regex(/^\d{1,64}$/),
});

export async function GET(request: Request) {
  const requestId = createRequestId();
  if (!env.whatsappVerifyToken) {
    return apiFailure(503, 'NOT_CONFIGURED', 'La integración de WhatsApp no está configurada.', requestId);
  }

  const parsed = verificationSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  );
  if (!parsed.success || !isValidVerifyToken(parsed.data['hub.verify_token'], env.whatsappVerifyToken)) {
    return apiFailure(403, 'FORBIDDEN', 'Verificación rechazada.', requestId);
  }

  return new Response(parsed.data['hub.challenge'], {
    status: 200,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
  });
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  if (!env.whatsappAppSecret) {
    return apiFailure(503, 'NOT_CONFIGURED', 'La integración de WhatsApp no está configurada.', requestId);
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return apiFailure(413, 'PAYLOAD_TOO_LARGE', 'La solicitud excede el tamaño permitido.', requestId);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return apiFailure(413, 'PAYLOAD_TOO_LARGE', 'La solicitud excede el tamaño permitido.', requestId);
  }

  if (!isValidWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'), env.whatsappAppSecret)) {
    return apiFailure(401, 'UNAUTHORIZED', 'Firma inválida.', requestId);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return apiFailure(400, 'INVALID_REQUEST', 'JSON inválido.', requestId);
  }

  const parsed = parseWebhookPayload(payload);
  if (!parsed.success) {
    return apiFailure(400, 'INVALID_REQUEST', 'Evento de WhatsApp no reconocido.', requestId);
  }

  if (parsed.batch.skippedChanges > 0 || parsed.batch.skippedItems > 0) {
    logger.info('Skipped WhatsApp webhook content', {
      requestId,
      skippedChanges: parsed.batch.skippedChanges,
      skippedItems: parsed.batch.skippedItems,
    });
  }

  try {
    // Un error de almacenamiento devuelve 500 para que Meta reintente la entrega.
    const stored = await storeWebhookBatch(parsed.batch);
    const { messages } = parsed.batch;
    if (messages.length > 0) {
      // El aviso push corre despues de responder para no retrasar a Meta.
      after(async () => {
        try {
          await notifyWhatsAppMessages(messages);
        } catch (error) {
          logger.warn('WhatsApp message push could not be sent', { requestId, error });
        }
      });
    }
    return apiSuccess(stored, requestId);
  } catch (error) {
    return apiErrorResponse('WhatsAppWebhookRoute', requestId, error);
  }
}
