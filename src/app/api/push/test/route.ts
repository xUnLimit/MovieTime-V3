import { sendForcedExecutivePush } from '@/modules/executive-push/executive-push-api';
import { emptyPushRequestSchema } from '@/modules/pwa/push-api-contracts';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    if (request.body !== null) {
      const parsed = await parseJsonRequest(request, emptyPushRequestSchema, 4 * 1024);
      if (!parsed.success) {
        return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
      }
    }
    const result = await sendForcedExecutivePush();
    return apiSuccess(result, requestId);
  } catch (error) {
    return apiErrorResponse('PushTestRoute', requestId, error);
  }
}
