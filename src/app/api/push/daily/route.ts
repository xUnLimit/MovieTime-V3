import { NextResponse } from 'next/server';

import {
  isAuthorizedExecutivePushCronRequest,
  sendScheduledExecutivePush,
} from '@/lib/executive-push/executive-push-api';

export const runtime = 'nodejs';

async function handleDailyPush(request: Request) {
  if (!isAuthorizedExecutivePushCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendScheduledExecutivePush(request);
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
