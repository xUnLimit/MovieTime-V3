import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { apiErrorResponse, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { drainWhatsAppInbox } from '../../webhook/inbox-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    return apiSuccess(await drainWhatsAppInbox(requestId), requestId);
  } catch (error) { return apiErrorResponse('WhatsAppInboxProcess', requestId, error); }
}
