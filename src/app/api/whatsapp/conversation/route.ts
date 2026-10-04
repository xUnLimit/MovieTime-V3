import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { conversationModeSchema, conversationQuerySchema } from '@/modules/whatsapp/conversation-contracts';
import { createConversationStore, setConversationMode } from '@/modules/whatsapp/conversation-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    const parsed = conversationQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return apiFailure(400, 'INVALID_REQUEST', 'El contacto no es válido.', requestId);
    return apiSuccess(await createConversationStore().get(parsed.data.waId), requestId);
  } catch (error) { return apiErrorResponse('ConversationControl', requestId, error); }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    const parsed = await parseJsonRequest(request, conversationModeSchema, 2048);
    if (!parsed.success) return apiFailure(parsed.status, parsed.code, parsed.message, requestId);
    if (!await setConversationMode(request.headers.get('authorization') ?? '', parsed.data)) {
      return apiFailure(409, 'INVALID_REQUEST', 'Actualiza el chat. Hay cambios o un envío pendiente de revisión.', requestId);
    }
    return apiSuccess(await createConversationStore().get(parsed.data.waId), requestId);
  } catch (error) { return apiErrorResponse('ConversationControl', requestId, error); }
}
