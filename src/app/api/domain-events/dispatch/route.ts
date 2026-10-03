import { createDomainEventHandlers, dispatchDomainEvents } from '@/application/use-cases/dispatch-domain-events';
import { createDomainEventStore } from '@/modules/domain-events';
import { isValidVerifyToken } from '@/modules/whatsapp/webhook-signature';
import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { z } from '@/platform/validation/zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 50;
const LOCK_SECONDS = 120;

// Mismo secreto de cron que los reintentos de WhatsApp (WHATSAPP_AUTO_NOTICES_SECRET).
export async function POST(request: Request) {
  const requestId = createRequestId();
  if (!env.whatsappAutoNoticesSecret) {
    return apiFailure(503, 'NOT_CONFIGURED', 'El despachador de eventos no esta configurado.', requestId);
  }
  const header = z.string().regex(/^Bearer [^\s]{16,512}$/).safeParse(request.headers.get('authorization'));
  if (!header.success || !isValidVerifyToken(header.data.slice(7), env.whatsappAutoNoticesSecret)) {
    return apiFailure(401, 'UNAUTHORIZED', 'Acceso no autorizado.', requestId);
  }
  const body = await parseJsonRequest(request, z.object({}).strict(), 1024);
  if (!body.success) return apiFailure(body.status, body.code, body.message, requestId);
  try {
    const result = await dispatchDomainEvents(
      { store: createDomainEventStore(), handlers: createDomainEventHandlers() }, BATCH_SIZE, LOCK_SECONDS,
    );
    return apiSuccess(result, requestId);
  } catch (error) {
    return apiErrorResponse('DomainEventsDispatchRoute', requestId, error);
  }
}
