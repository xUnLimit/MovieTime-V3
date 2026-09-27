import { getYappyServerConfig } from '@/platform/config/yappy-server';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { syncYappyUseCase } from '@/application/use-cases/yappy-sync-use-case';
import { z } from '@/platform/validation/zod';
import { HttpError } from '@/platform/server/api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    const config = getYappyServerConfig();
    if (!config) return apiFailure(503, 'NOT_CONFIGURED', 'La integración de Yappy no está configurada.', requestId);
    const body = await parseJsonRequest(request, z.object({}).strict(), 1024);
    if (!body.success) return apiFailure(body.status, body.code, body.message, requestId);
    return apiSuccess(await syncYappyUseCase(config, undefined, true), requestId);
  } catch (error) {
    return apiErrorResponse('YappyManualSyncRoute', requestId,
      error instanceof HttpError ? error : new Error('Yappy manual synchronization failed'));
  }
}
