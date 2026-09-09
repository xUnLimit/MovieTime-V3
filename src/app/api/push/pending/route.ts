import { getExecutivePushSummaryForEndpoint } from '@/modules/executive-push/executive-push-delivery';
import { pushEndpointSchema } from '@/modules/pwa/push-api-contracts';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const { user } = await requireAuthenticatedAdmin(request);
    const parsed = await parseJsonRequest(request, pushEndpointSchema, 4 * 1024);
    if (!parsed.success) {
      return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
    }

    const summary = await getExecutivePushSummaryForEndpoint(parsed.data.endpoint, user.id);
    return apiSuccess(summary, requestId);
  } catch (error) {
    return apiErrorResponse('PushPendingRoute', requestId, error);
  }
}
