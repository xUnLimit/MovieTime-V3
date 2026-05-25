import { NextResponse } from 'next/server';

import { sendExecutivePushDailySummary } from '@/lib/executive-push/executive-push-delivery';
import { requireAuthenticatedAdmin } from '@/lib/server/request-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await requireAuthenticatedAdmin(request);
    const result = await sendExecutivePushDailySummary({ force: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
