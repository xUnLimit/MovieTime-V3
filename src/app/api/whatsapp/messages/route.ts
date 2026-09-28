import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { sendCloudApiMessage } from '@/modules/whatsapp/cloud-api-client';
import { sendWhatsAppMessageSchema } from '@/modules/whatsapp/outbound-contracts';
import {
  CustomerWindowClosedError,
  InvalidTemplateParamsError,
  TemplateNotApprovedError,
  sendOutboundMessage,
} from '@/modules/whatsapp/outbound-messages';
import { createOutboundStore } from '@/modules/whatsapp/outbound-store';
import { createTemplateCatalog } from '@/modules/whatsapp/template-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const { user } = await requireAuthenticatedAdmin(request);

    if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
      return apiFailure(503, 'NOT_CONFIGURED', 'La integración de WhatsApp no está configurada.', requestId);
    }

    const parsed = await parseJsonRequest(request, sendWhatsAppMessageSchema, 16 * 1024);
    if (!parsed.success) {
      return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
    }

    const { idempotencyKey, to, message } = parsed.data;
    const config = { accessToken: env.whatsappAccessToken, phoneNumberId: env.whatsappPhoneNumberId };
    const result = await sendOutboundMessage(
      { idempotencyKey, toWaId: to, payload: message, sentBy: user.id },
      { store: createOutboundStore(), catalog: createTemplateCatalog(), send: (recipient, payload) => sendCloudApiMessage(config, recipient, payload) }
    );

    return apiSuccess(result, requestId);
  } catch (error) {
    if (error instanceof CustomerWindowClosedError) {
      return apiFailure(
        409,
        'WHATSAPP_WINDOW_CLOSED',
        'El cliente no ha escrito en las últimas 24 horas. Usa una plantilla.',
        requestId
      );
    }
    if (error instanceof InvalidTemplateParamsError || error instanceof TemplateNotApprovedError) {
      return apiFailure(400, 'INVALID_REQUEST', 'Los datos de la plantilla no son válidos.', requestId);
    }
    return apiErrorResponse('WhatsAppMessagesRoute', requestId, error);
  }
}
