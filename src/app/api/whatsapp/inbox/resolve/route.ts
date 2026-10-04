import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { conversationReviewSchema } from '@/modules/whatsapp/conversation-contracts';
import { createConversationStore, resolveConversationReview } from '@/modules/whatsapp/conversation-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    const parsed = await parseJsonRequest(request, conversationReviewSchema, 2048);
    if (!parsed.success) return apiFailure(parsed.status, parsed.code, parsed.message, requestId);
    if (!await resolveConversationReview(request.headers.get('authorization') ?? '', parsed.data)) {
      return apiFailure(409, 'INVALID_REQUEST', 'Actualiza el chat antes de resolver el mensaje.', requestId);
    }
    return apiSuccess(await createConversationStore().get(parsed.data.waId), requestId);
  } catch (error) { return apiErrorResponse('WhatsAppInboxReview', requestId, error); }
}
