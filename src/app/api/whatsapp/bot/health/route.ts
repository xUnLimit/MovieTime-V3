import { env } from '@/platform/config';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { HttpError } from '@/platform/server/api-errors';
import { commerceCanvasEnabled } from '@/platform/config/commerce-flow';
import { flowExtensionsEnabled } from '@/platform/config/flow-extensions';
import { getNetflixMailConfig } from '@/platform/config/netflix-server';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { z } from '@/platform/validation/zod';
import type { BotHealth } from '@/types/bot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noQuery = z.object({}).strict();

// Solo indica si las integraciones estan configuradas; nunca expone sus valores.
export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    await requireAuthenticatedAdmin(request);
    const query = noQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return apiFailure(400, 'INVALID_REQUEST', 'La solicitud no admite parámetros.', requestId);
    const data: Pick<BotHealth, 'whatsappConfigured' | 'mailboxConfigured' | 'purchaseBlocksEnabled' | 'flowExtensionsEnabled'> = {
      whatsappConfigured: Boolean(env.whatsappAccessToken && env.whatsappAppSecret && env.whatsappVerifyToken),
      mailboxConfigured: getNetflixMailConfig() !== null,
      purchaseBlocksEnabled: commerceCanvasEnabled(),
      flowExtensionsEnabled: flowExtensionsEnabled(),
    };
    return apiSuccess(data, requestId);
  } catch (error) {
    return apiErrorResponse('BotHealthRoute', requestId,
      error instanceof HttpError ? error : new Error('Bot health check failed'));
  }
}
