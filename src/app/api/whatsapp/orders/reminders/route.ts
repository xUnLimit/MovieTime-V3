import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { z } from '@/platform/validation/zod';
import { isValidVerifyToken } from '@/modules/whatsapp/webhook-signature';
import { runOrderReminders } from '@/application/use-cases/order-reminders-use-case';
import { createOrderReminderDeps } from '@/application/use-cases/payment-wiring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Disparo externo (mismo secreto Bearer que los avisos automaticos); el scheduler lo llama cada 15-60 min.
export async function POST(request: Request) {
  const requestId = createRequestId();
  if (!env.whatsappAutoNoticesSecret || !env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
    return apiFailure(503, 'NOT_CONFIGURED', 'La integración de WhatsApp no está configurada.', requestId);
  }
  const header = z.string().regex(/^Bearer [^\s]{16,512}$/).safeParse(request.headers.get('authorization'));
  if (!header.success || !isValidVerifyToken(header.data.slice(7), env.whatsappAutoNoticesSecret)) {
    return apiFailure(401, 'UNAUTHORIZED', 'Acceso no autorizado.', requestId);
  }
  const body = await parseJsonRequest(request, z.object({}).strict(), 1024);
  if (!body.success) return apiFailure(body.status, body.code, body.message, requestId);
  try {
    return apiSuccess(await runOrderReminders(createOrderReminderDeps()), requestId);
  } catch (error) {
    return apiErrorResponse('OrderRemindersRoute', requestId, error);
  }
}
