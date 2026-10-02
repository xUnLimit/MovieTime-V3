import { getNetflixMailConfig } from '@/platform/config/netflix-server';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { HttpError } from '@/platform/server/api-errors';
import { checkNetflixMailbox, createRateLimiter } from '@/platform/server/bot-mailbox-check';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { z } from '@/platform/validation/zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Una comprobacion cada 10 s por administrador (en memoria: basta para frenar clics repetidos).
const takeSlot = createRateLimiter(10_000);

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const { user } = await requireAuthenticatedAdmin(request);
    const body = await parseJsonRequest(request, z.object({}).strict(), 1024);
    if (!body.success) return apiFailure(body.status, body.code, body.message, requestId);
    if (takeSlot(user.id) > 0) {
      return apiFailure(429, 'RATE_LIMITED', 'Espera unos segundos antes de volver a probar el buzón.', requestId);
    }
    return apiSuccess(await checkNetflixMailbox(getNetflixMailConfig()), requestId);
  } catch (error) {
    return apiErrorResponse('BotMailboxCheckRoute', requestId,
      error instanceof HttpError ? error : new Error('Bot mailbox check failed'));
  }
}
