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
import { codeWelcome } from './code-welcome';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Avisos que siguen a una accion del panel y salen solos cuando el WhatsApp automatico esta encendido. */
const AUTOMATIC_TIPOS: readonly string[] = ['renovacion', 'suscripcion', 'actualizacion_credenciales',
  'transferencia_servicio', 'dia_pago', 'cancelacion'];

const requestSchema = z.object({
  tipo: z.enum(['notificacion_regular', 'dia_pago', 'renovacion', 'suscripcion',
    'cancelacion', 'actualizacion_credenciales', 'transferencia_servicio', 'datos_pago', 'despedida']),
  ventaIds: z.array(z.string().uuid()).min(1).max(200),
  eventId: z.string().uuid().optional(),
  /** Aviso posterior a una accion del panel que el sistema envia solo si el WhatsApp automatico esta encendido. */
  automatic: z.boolean().optional(),
}).refine((body) => !body.automatic || AUTOMATIC_TIPOS.includes(body.tipo), {
  path: ['automatic'], message: 'Este aviso no puede enviarse de forma automática.',
});

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const { user } = await requireAuthenticatedAdmin(request);
    const parsed = await parseJsonRequest(request, requestSchema, 16 * 1024);
    if (!parsed.success) return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
    const { automatic, ...notice } = parsed.data;
    // Apagado, no sale nada: quien hizo la accion elige como avisar (API o WhatsApp).
    if (automatic && !(await createAutoNoticeStore().config()).enabled) {
      return apiSuccess({ results: [], skipped: 'auto_disabled' }, requestId);
    }
    if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
      return apiFailure(503, 'NOT_CONFIGURED', 'La integración de WhatsApp no está configurada.', requestId);
    }
    const catalog = createTemplateCatalog();
    const outboundStore = createOutboundStore();
    const config = { accessToken: env.whatsappAccessToken, phoneNumberId: env.whatsappPhoneNumberId };
    const results = await sendNotice({ ...notice, origin: automatic ? 'auto' : 'manual', sentBy: user.id, now: new Date() }, {
      store: createNoticeStore(), catalog, codeWelcome,
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
