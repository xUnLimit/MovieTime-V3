import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { createMetaTemplateStore, syncMetaTemplates } from '@/modules/whatsapp/meta-template-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    if (!env.whatsappWabaId || !env.whatsappAccessToken) {
      return apiFailure(503, 'NOT_CONFIGURED', 'La integracion de WhatsApp no esta configurada.', requestId);
    }
    const count = await syncMetaTemplates(env.whatsappWabaId, env.whatsappAccessToken, createMetaTemplateStore());
    return apiSuccess({ count }, requestId);
  } catch (error) {
    return apiErrorResponse('WhatsAppTemplateSyncRoute', requestId, error);
  }
}
