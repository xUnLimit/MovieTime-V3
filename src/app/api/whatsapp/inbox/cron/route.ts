import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { isAuthorizedInboxCron } from '@/modules/whatsapp/inbox-cron-auth';
import { drainWhatsAppInbox } from '../../webhook/inbox-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const requestId = createRequestId();
  if (!isAuthorizedInboxCron(request)) return apiFailure(401, 'UNAUTHORIZED', 'Credenciales de ejecución inválidas.', requestId);
  try { return apiSuccess(await drainWhatsAppInbox(requestId), requestId); }
  catch (error) { return apiErrorResponse('WhatsAppInboxCron', requestId, error); }
}
