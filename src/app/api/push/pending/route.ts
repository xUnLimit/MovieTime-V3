import { NextResponse } from 'next/server';

import { getExecutivePushSummaryForEndpoint } from '@/lib/services/executivePushService';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const endpoint = String(payload.endpoint ?? '');
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required.' }, { status: 400 });
    }

    const summary = await getExecutivePushSummaryForEndpoint(endpoint);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to resolve push summary.' },
      { status: 500 }
    );
  }
}
