import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedAdmin(request);
    const payload = await request.json();
    const endpoint = String(payload.endpoint ?? '');
    const p256dh = String(payload.p256dh ?? '');
    const auth = String(payload.auth ?? '');

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Invalid subscription payload.' }, { status: 400 });
    }

    const client = createServiceRoleClient();
    const { error } = await client.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      platform: String(payload.platform ?? 'unknown'),
      user_agent: String(payload.userAgent ?? ''),
      last_seen_at: new Date().toISOString(),
      enabled: true,
    }, { onConflict: 'endpoint' });

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

export async function DELETE(request: Request) {
  try {
    const { user } = await requireAuthenticatedAdmin(request);
    const payload = await request.json();
    const endpoint = String(payload.endpoint ?? '');
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required.' }, { status: 400 });
    }

    const client = createServiceRoleClient();
    const { error } = await client
      .from('push_subscriptions')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

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
