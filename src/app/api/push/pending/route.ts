import { NextResponse } from 'next/server';

import { getExecutivePushSummaryForEndpoint } from '@/lib/executive-push/executive-push-delivery';
import { requireAuthenticatedAdmin } from '@/lib/server/request-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedAdmin(request);
    const payload = await request.json();
    const endpoint = String(payload.endpoint ?? '');
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required.' }, { status: 400 });
    }

    const summary = await getExecutivePushSummaryForEndpoint(endpoint, user.id);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
