import {
  isAuthorizedExecutivePushCronRequest,
  sendScheduledExecutivePush,
} from '@/modules/executive-push/executive-push-api';
import { executivePushRunSchema } from '@/modules/pwa/push-api-contracts';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';

export const runtime = 'nodejs';

async function readRunId(request: Request, requestId: string) {
  if (request.method === 'GET') {
    const parsed = executivePushRunSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    if (!parsed.success) {
      return { response: apiFailure(400, 'INVALID_REQUEST', 'El identificador de ejecución no es válido.', requestId) };
    }
    return { runId: parsed.data.run_id };
  }

  if (request.body === null) return { runId: undefined };
  const parsed = await parseJsonRequest(request, executivePushRunSchema, 4 * 1024);
  if (!parsed.success) {
    return {
      response: apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors),
    };
  }
  return { runId: parsed.data.run_id };
}

async function handleDailyPush(request: Request) {
  const requestId = createRequestId();
  if (!isAuthorizedExecutivePushCronRequest(request)) {
    return apiFailure(401, 'UNAUTHORIZED', 'Credenciales de ejecución inválidas.', requestId);
  }

  const input = await readRunId(request, requestId);
  if (input.response) return input.response;

  try {
    const result = await sendScheduledExecutivePush(input.runId);
    if (result.skipped === 'no_successful_deliveries') {
      return apiFailure(
        502,
        'NO_SUCCESSFUL_DELIVERIES',
        'No se pudo entregar la notificación a ningún dispositivo.',
        requestId
      );
    }
    return apiSuccess(result, requestId);
  } catch (error) {
    return apiErrorResponse('PushDailyRoute', requestId, error);
  }
}

export async function GET(request: Request) {
  return handleDailyPush(request);
}

export async function POST(request: Request) {
  return handleDailyPush(request);
}
