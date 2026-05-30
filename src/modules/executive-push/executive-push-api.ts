import { env } from '@/platform/config';
import { sendExecutivePushDailySummary } from '@/modules/executive-push/executive-push-delivery';

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
  const cronSecret = request.headers.get('x-push-cron-secret');
  const authorization = request.headers.get('authorization');
  return Boolean(
    env.pushCronSecret &&
      (cronSecret === env.pushCronSecret || authorization === `Bearer ${env.pushCronSecret}`)
  );
}

export async function sendScheduledExecutivePush(request: Request) {
  return sendExecutivePushDailySummary({ runId: await readExecutivePushRunId(request) });
}

export async function sendForcedExecutivePush() {
  return sendExecutivePushDailySummary({ force: true });
}
