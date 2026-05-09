import { NextResponse } from 'next/server';

import { env } from '@/config';
import { sendExecutivePushDailySummary } from '@/lib/services/executivePushService';

export const runtime = 'nodejs';

function isAuthorizedCronRequest(request: Request) {
  // GitHub Actions / manual calls use a shared secret in Authorization or a custom header.
  const cronSecret = request.headers.get('x-push-cron-secret');
  const authorization = request.headers.get('authorization');
  return Boolean(
    env.pushCronSecret &&
      (cronSecret === env.pushCronSecret || authorization === `Bearer ${env.pushCronSecret}`)
  );
}

async function handleDailyPush(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendExecutivePushDailySummary();
    if (result.skipped === 'no_successful_deliveries') {
      return NextResponse.json({ ok: false, ...result }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to send daily executive push.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleDailyPush(request);
}

export async function POST(request: Request) {
  return handleDailyPush(request);
}
