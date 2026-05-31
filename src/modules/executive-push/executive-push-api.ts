import { createHash, timingSafeEqual } from 'node:crypto';

import { env } from '@/platform/config';
import { sendExecutivePushDailySummary } from '@/modules/executive-push/executive-push-delivery';

// Comparación de secretos en tiempo constante. Se hashea cada lado a un buffer de
// tamaño fijo (SHA-256) para que timingSafeEqual no lance por longitudes distintas
// y para no filtrar la longitud del secreto por la duración de la comparación.
function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function readExecutivePushRunId(request: Request) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    return url.searchParams.get('run_id') ?? undefined;
  }

  try {
    const body = await request.json() as unknown;
    if (body && typeof body === 'object' && 'run_id' in body) {
      const runId = (body as { run_id?: unknown }).run_id;
      return typeof runId === 'string' && runId.length > 0 ? runId : undefined;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function isAuthorizedExecutivePushCronRequest(request: Request) {
  if (!env.pushCronSecret) return false;

  const cronSecret = request.headers.get('x-push-cron-secret');
  const authorization = request.headers.get('authorization');
  const bearerSecret = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  return secretsMatch(cronSecret, env.pushCronSecret) || secretsMatch(bearerSecret, env.pushCronSecret);
}

export async function sendScheduledExecutivePush(request: Request) {
  return sendExecutivePushDailySummary({ runId: await readExecutivePushRunId(request) });
}

export async function sendForcedExecutivePush() {
  return sendExecutivePushDailySummary({ force: true });
}
