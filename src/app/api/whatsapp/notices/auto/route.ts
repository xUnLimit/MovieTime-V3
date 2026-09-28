import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { z } from '@/platform/validation/zod';
import { isValidVerifyToken } from '@/modules/whatsapp/webhook-signature';
import { runAutoNotices } from '@/application/use-cases/auto-notices-use-case';
import { createAutoNoticeStore } from '@/modules/messaging/auto-notice-store';
import { createNoticeStore } from '@/modules/messaging/notice-store';
import { notifyAdminsAboutNotices } from '@/modules/notifications/admin-notice-push';
import { sendCloudApiMessage } from '@/modules/whatsapp/cloud-api-client';
import { syncMetaTemplates, createMetaTemplateStore } from '@/modules/whatsapp/meta-template-sync';
import { sendOutboundMessage } from '@/modules/whatsapp/outbound-messages';
import { createOutboundStore } from '@/modules/whatsapp/outbound-store';
import { createTemplateCatalog } from '@/modules/whatsapp/template-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const requestId = createRequestId();
  if (!env.whatsappAutoNoticesSecret || !env.whatsappAccessToken || !env.whatsappWabaId || !env.whatsappPhoneNumberId) {
    return apiFailure(503, 'NOT_CONFIGURED', 'La integración de WhatsApp no está configurada.', requestId);
  }
  const header = z.string().regex(/^Bearer [^\s]{16,512}$/).safeParse(request.headers.get('authorization'));
  if (!header.success || !isValidVerifyToken(header.data.slice(7), env.whatsappAutoNoticesSecret)) {
    return apiFailure(401, 'UNAUTHORIZED', 'Acceso no autorizado.', requestId);
  }
  const body = await parseJsonRequest(request, z.object({}).strict(), 1024);
  if (!body.success) return apiFailure(body.status, body.code, body.message, requestId);
  try {
    const catalog = createTemplateCatalog();
    const outboundStore = createOutboundStore();
    const config = { accessToken: env.whatsappAccessToken, phoneNumberId: env.whatsappPhoneNumberId };
    const result = await runAutoNotices({
      now: () => new Date(), runs: createAutoNoticeStore(), notifyAdmins: notifyAdminsAboutNotices,
      syncTemplates: () => syncMetaTemplates(env.whatsappWabaId, env.whatsappAccessToken, createMetaTemplateStore()),
      notices: {
        store: createNoticeStore(), catalog,
        send: (message) => sendOutboundMessage(message, {
          store: outboundStore, catalog,
          send: (recipient, payload) => sendCloudApiMessage(config, recipient, payload),
        }),
      },
    });
    return apiSuccess(result, requestId);
  } catch (error) {
    return apiErrorResponse('WhatsAppAutoNoticesRoute', requestId, error);
  }
}
