import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { z } from '@/platform/validation/zod';
import { sendNotice } from '@/application/use-cases/send-notice-use-case';
import { createAutoNoticeStore } from '@/modules/messaging/auto-notice-store';
import { createNoticeStore } from '@/modules/messaging/notice-store';
import { sendCloudApiMessage } from '@/modules/whatsapp/cloud-api-client';
import { sendOutboundMessage } from '@/modules/whatsapp/outbound-messages';
import { createOutboundStore } from '@/modules/whatsapp/outbound-store';
import { createTemplateCatalog } from '@/modules/whatsapp/template-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  tipo: z.enum(['notificacion_regular', 'dia_pago', 'renovacion', 'suscripcion',
    'cancelacion', 'actualizacion_credenciales', 'transferencia_servicio', 'datos_pago', 'datos_acceso', 'despedida']),
  ventaIds: z.array(z.string().uuid()).min(1).max(200),
  eventId: z.string().uuid().optional(),
  /** Confirmacion de renovacion que el sistema envia solo cuando el WhatsApp automatico esta encendido. */
  automatic: z.boolean().optional(),
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
    const { automatic, ...notice } = parsed.data;
    if (automatic) {
      if (notice.tipo !== 'renovacion' || notice.ventaIds.length !== 1) {
        return apiFailure(400, 'INVALID_REQUEST', 'Solo la confirmación de una renovación puede enviarse de forma automática.', requestId);
      }
      // Apagado, no sale nada: quien renovo elige como avisar (API o WhatsApp).
      if (!(await createAutoNoticeStore().config()).enabled) return apiSuccess({ results: [], skipped: 'auto_disabled' }, requestId);
    }
    const catalog = createTemplateCatalog();
    const outboundStore = createOutboundStore();
    const config = { accessToken: env.whatsappAccessToken, phoneNumberId: env.whatsappPhoneNumberId };
    const results = await sendNotice({ ...notice, origin: automatic ? 'auto' : 'manual', sentBy: user.id, now: new Date() }, {
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
