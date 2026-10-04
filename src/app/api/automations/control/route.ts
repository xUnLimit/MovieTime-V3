import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { controlCommandSchema } from '@/modules/automation-control/contracts';
import { executeAutomationControlUseCase, readAutomationControlUseCase } from '@/application/use-cases/automation-control-server-use-case';

export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    return apiSuccess(await readAutomationControlUseCase(), requestId);
  } catch (error) { return apiErrorResponse('AutomationControl', requestId, error); }
}
export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    const parsed = await parseJsonRequest(request, controlCommandSchema, 8192);
    if (!parsed.success) return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
    return apiSuccess(await executeAutomationControlUseCase(parsed.data, request.headers.get('authorization')!), requestId);
  } catch (error) { return apiErrorResponse('AutomationControl', requestId, error); }
}
