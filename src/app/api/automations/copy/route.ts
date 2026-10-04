import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { copyCommandSchema } from '@/modules/commerce-copy/contracts';
import { readCommerceCopyUseCase, saveCommerceCopyUseCase } from '@/application/use-cases/commerce-copy-server-use-case';

export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    return apiSuccess(await readCommerceCopyUseCase(), requestId);
  } catch (error) { return apiErrorResponse('CommerceCopy', requestId, error); }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    const parsed = await parseJsonRequest(request, copyCommandSchema, 4096);
    if (!parsed.success) return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
    return apiSuccess(await saveCommerceCopyUseCase(parsed.data, request.headers.get('authorization')!), requestId);
  } catch (error) { return apiErrorResponse('CommerceCopy', requestId, error); }
}
