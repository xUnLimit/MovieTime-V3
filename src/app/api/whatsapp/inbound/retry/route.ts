import { retryPendingInboundMessages } from '@/application/use-cases/process-inbound-message';
import { createInboundQueueStore } from '@/modules/whatsapp/inbound-queue-store';
import { isValidVerifyToken } from '@/modules/whatsapp/webhook-signature';
import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { z } from '@/platform/validation/zod';
import { createInboundPipelineDeps } from '../../webhook/inbound-pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH_SIZE = 10;
const LOCK_SECONDS = 300;

export async function POST(request: Request) {
  const requestId = createRequestId();
  if (!env.whatsappAutoNoticesSecret || !env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
    return apiFailure(503, 'NOT_CONFIGURED', 'La integracion de WhatsApp no esta configurada.', requestId);
  }
  const header = z.string().regex(/^Bearer [^\s]{16,512}$/).safeParse(request.headers.get('authorization'));
  if (!header.success || !isValidVerifyToken(header.data.slice(7), env.whatsappAutoNoticesSecret)) {
    return apiFailure(401, 'UNAUTHORIZED', 'Acceso no autorizado.', requestId);
  }
  const body = await parseJsonRequest(request, z.object({}).strict(), 1024);
  if (!body.success) return apiFailure(body.status, body.code, body.message, requestId);
  try {
    const config = { accessToken: env.whatsappAccessToken, phoneNumberId: env.whatsappPhoneNumberId };
    const result = await retryPendingInboundMessages(
      { ...createInboundPipelineDeps(config, requestId), queue: createInboundQueueStore() },
      BATCH_SIZE, LOCK_SECONDS,
    );
    return apiSuccess(result, requestId);
  } catch (error) {
    return apiErrorResponse('WhatsAppInboundRetryRoute', requestId, error);
  }
}
