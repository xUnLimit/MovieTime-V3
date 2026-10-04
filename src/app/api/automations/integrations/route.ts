import { authorizeIntegration } from '@/modules/automation-control/integration-auth';
import { integrationCommandSchema, executeIntegrationUseCase } from '@/application/use-cases/automation-integration-use-case';
import { parseJsonRequest } from '@/platform/server/json-request';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    authorizeIntegration(request);
    const command = await parseJsonRequest(request, integrationCommandSchema, 2048);
    if (!command.success) return apiFailure(command.status, command.code, command.message, requestId, command.fieldErrors);
    return apiSuccess(await executeIntegrationUseCase(command.data), requestId);
  } catch (error) { return apiErrorResponse('AutomationIntegration', requestId, error); }
}
