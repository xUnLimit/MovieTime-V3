import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createUserClient } from '@/test/integration/clients';
import { requireIntegrationEnv } from '@/test/integration/env';
import { FixtureScope, newUuid, uniqueId, uniqueWaId, unwrap } from '@/test/integration/fixtures';

describe.skipIf(requireIntegrationEnv() === null)('integracion: Realtime de reportes conserva RLS', () => {
  const scope = new FixtureScope();
  const clients: SupabaseClient[] = [];
  let waId: string;
  beforeAll(async () => {
    for (const role of ['admin', 'operador'] as const) {
      const user = await scope.createUser({ role });
      clients.push(await createUserClient(user.email, user.password));
    }
    waId = scope.trackWaId(uniqueWaId());
  });
  afterAll(async () => {
    for (const client of clients) {
      await client.removeAllChannels();
      await client.auth.signOut();
    }
    if (waId) unwrap(await scope.service.from('customer_reports').delete().eq('wa_id', waId).select('id'), 'limpiar reportes');
    await scope.cleanup();
  });
  it('envia altas y cambios al administrador, sin enviarlos al operador', async () => {
    const id = newUuid();
    const events = [0, 0];
    await Promise.all(clients.map((client, index) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Realtime no se suscribio')), 10_000);
      client.channel(uniqueId('report-realtime'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_reports', filter: `id=eq.${id}` }, () => { events[index] += 1; })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error('Realtime no disponible')); }
        });
    })));
    const messageId = uniqueId('report-message');
    unwrap(await scope.service.from('whatsapp_inbound_messages').insert({ wa_message_id: messageId,
      phone_number_id: 'fixture-phone', from_wa_id: waId, message_type: 'text', text_body: 'Reporte de prueba', sent_at: new Date().toISOString() }).select('id'), 'crear mensaje');
    unwrap(await scope.service.from('whatsapp_conversation_state').upsert({ wa_id: waId }).select('wa_id'), 'crear conversacion');
    unwrap(await scope.service.from('customer_reports').insert({ id, wa_id: waId, source_message_id: messageId, description: 'Reporte de prueba' }).select('id'), 'crear reporte');
    await vi.waitFor(() => expect(events[0]).toBe(1), { timeout: 10_000 });
    unwrap(await clients[0].rpc('update_customer_report', { p_id: id, p_status: 'resolved', p_version: 0 }), 'resolver reporte');
    await vi.waitFor(() => expect(events[0]).toBe(2), { timeout: 10_000 });
    await new Promise(resolve => setTimeout(resolve, 2_000));
    expect(events[1]).toBe(0);
  }, 30_000);
});
