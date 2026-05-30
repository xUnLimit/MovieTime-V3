import { NextResponse } from 'next/server';

import { sendForcedExecutivePush } from '@/lib/executive-push/executive-push-api';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await requireAuthenticatedAdmin(request);
    const result = await sendForcedExecutivePush();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
