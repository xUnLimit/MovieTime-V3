import { getYappyServerConfig } from '@/platform/config/yappy-server';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { isValidVerifyToken } from '@/modules/whatsapp/webhook-signature';
import { z } from '@/platform/validation/zod';
import { syncYappyUseCase } from '@/application/use-cases/yappy-sync-use-case';
import { parseJsonRequest } from '@/platform/server/json-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const requestId = createRequestId();
  const config = getYappyServerConfig();
  if (!config) return apiFailure(503, 'NOT_CONFIGURED', 'La integración de Yappy no está configurada.', requestId);
  const header = z.string().regex(/^Bearer [^\s]{16,512}$/).safeParse(request.headers.get('authorization'));
  if (!header.success || !isValidVerifyToken(header.data.slice(7), config.syncSecret)) {
    return apiFailure(401, 'UNAUTHORIZED', 'Acceso no autorizado.', requestId);
  }
  const body = await parseJsonRequest(request, z.object({}).strict(), 1024);
  if (!body.success) return apiFailure(body.status, body.code, body.message, requestId);
  try { return apiSuccess(await syncYappyUseCase(config), requestId); }
  catch { return apiErrorResponse('YappySyncRoute', requestId, new Error('Yappy synchronization failed')); }
}
