import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { markConversationReadSchema } from '@/modules/whatsapp/outbound-contracts';
import { markConversationRead } from '@/modules/whatsapp/read-receipts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);

    if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
      return apiFailure(503, 'NOT_CONFIGURED', 'La integración de WhatsApp no está configurada.', requestId);
    }

    const parsed = await parseJsonRequest(request, markConversationReadSchema, 2 * 1024);
    if (!parsed.success) {
      return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
    }

    const config = { accessToken: env.whatsappAccessToken, phoneNumberId: env.whatsappPhoneNumberId };
    await markConversationRead(config, parsed.data.waId, parsed.data.readAt);

    return apiSuccess({ ok: true }, requestId);
  } catch (error) {
    return apiErrorResponse('WhatsAppReadRoute', requestId, error);
  }
}
