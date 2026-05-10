import { NextResponse } from 'next/server';

import { requireAuthenticatedAdmin } from '@/lib/server/request-auth';
import { createServiceRoleClient } from '@/lib/server/supabase-server';

export async function POST(request: Request) {
  try {
    await requireAuthenticatedAdmin(request);

    const serviceClient = createServiceRoleClient();
    const { error } = await serviceClient.rpc('rebuild_dashboard_financial_stats');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
