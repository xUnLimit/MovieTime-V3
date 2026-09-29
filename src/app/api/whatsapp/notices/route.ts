import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { z } from '@/platform/validation/zod';
import { sendNotice } from '@/application/use-cases/send-notice-use-case';
import { createNoticeStore } from '@/modules/messaging/notice-store';
import { sendCloudApiMessage } from '@/modules/whatsapp/cloud-api-client';
import { sendOutboundMessage } from '@/modules/whatsapp/outbound-messages';
import { createOutboundStore } from '@/modules/whatsapp/outbound-store';
import { createTemplateCatalog } from '@/modules/whatsapp/template-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  tipo: z.enum(['notificacion_regular', 'dia_pago', 'renovacion', 'suscripcion',
    'cancelacion', 'actualizacion_credenciales', 'transferencia_servicio', 'datos_pago', 'despedida']),
  ventaIds: z.array(z.string().uuid()).min(1).max(200),
  eventId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const { user } = await requireAuthenticatedAdmin(request);
    if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
      return apiFailure(503, 'NOT_CONFIGURED', 'La integración de WhatsApp no está configurada.', requestId);
    }
    const parsed = await parseJsonRequest(request, requestSchema, 16 * 1024);
    if (!parsed.success) return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
    const catalog = createTemplateCatalog();
    const outboundStore = createOutboundStore();
    const config = { accessToken: env.whatsappAccessToken, phoneNumberId: env.whatsappPhoneNumberId };
    const results = await sendNotice({ ...parsed.data, origin: 'manual', sentBy: user.id, now: new Date() }, {
      store: createNoticeStore(), catalog,
      send: (message) => sendOutboundMessage(message, {
        store: outboundStore, catalog,
        send: (recipient, payload) => sendCloudApiMessage(config, recipient, payload),
      }),
    });
    return apiSuccess({ results }, requestId);
  } catch (error) {
    return apiErrorResponse('WhatsAppNoticesRoute', requestId, error);
  }
}
