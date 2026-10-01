import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createUserClient } from '@/test/integration/clients';
import { requireIntegrationEnv } from '@/test/integration/env';
import { FixtureScope, uniqueId, uniqueWaId, unwrap } from '@/test/integration/fixtures';

const EVENT_TIMEOUT_MS = 10_000;
const SILENCE_MS = 4_000;
const MAX_INSERT_ATTEMPTS = 3;

type Subscription = { channel: RealtimeChannel; events: string[]; ready: Promise<string> };

// Realtime solo emite eventos de filas que el JWT del suscriptor puede leer (RLS de SELECT).
// Requiere la publicacion de 20260930130000_whatsapp_realtime_publication.sql.
describe.skipIf(requireIntegrationEnv() === null)('integracion: Realtime de la bandeja de WhatsApp', () => {
  const scope = new FixtureScope();
  let admin: SupabaseClient;
  let inactive: SupabaseClient;

  /** Suscribe a INSERT en whatsapp_inbound_messages y acumula los wa_message_id recibidos. */
  function subscribe(client: SupabaseClient): Subscription {
    const events: string[] = [];
    let settle: (status: string) => void = () => undefined;
    const ready = new Promise<string>((resolve) => {
      settle = resolve;
      setTimeout(() => resolve('TIMEOUT'), EVENT_TIMEOUT_MS);
    });
    const channel = client
      .channel(uniqueId('inbox'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_inbound_messages' }, (payload) => {
        events.push(String((payload.new as Record<string, unknown>).wa_message_id));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') settle(status);
      });
    return { channel, events, ready };
  }

  async function waitFor(condition: () => boolean, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (condition()) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return condition();
  }

  beforeAll(async () => {
    const adminUser = await scope.createUser({ role: 'admin' });
    const inactiveUser = await scope.createUser({ role: 'admin', active: false });
    admin = await createUserClient(adminUser.email, adminUser.password);
    inactive = await createUserClient(inactiveUser.email, inactiveUser.password);
  });

  afterAll(async () => {
    await Promise.all([admin, inactive].map(async (client) => {
      await client?.removeAllChannels();
      await client?.auth.signOut();
    }));
    await scope.cleanup();
  });

  it('un admin activo recibe el INSERT de un mensaje entrante y un usuario inactivo no', async () => {
    const waId = scope.trackWaId(uniqueWaId());
    const adminSub = subscribe(admin);
    const inactiveSub = subscribe(inactive);
    expect(await adminSub.ready).toBe('SUBSCRIBED');
    // El inactivo puede quedar suscrito o ser rechazado: lo que importa es que no recibe filas.
    await inactiveSub.ready;

    // Tras un arranque limpio, Realtime puede tardar en empezar a replicar aunque el canal ya este suscrito:
    // se reintenta con un mensaje nuevo en vez de esperar mas en el primero.
    const sent: string[] = [];
    let adminReceived = false;
    for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS && !adminReceived; attempt += 1) {
      const waMessageId = uniqueId('wamid');
      sent.push(waMessageId);
      unwrap(
        await scope.service
          .from('whatsapp_inbound_messages')
          .insert({ wa_message_id: waMessageId, phone_number_id: 'fixture', from_wa_id: waId, message_type: 'text', text_body: 'hola', sent_at: new Date().toISOString() })
          .select('id'),
        'mensaje entrante'
      );
      adminReceived = await waitFor(() => adminSub.events.some((id) => sent.includes(id)), EVENT_TIMEOUT_MS);
    }

    expect(adminReceived).toBe(true);
    // El admin ya lo recibio: esperar un margen adicional demuestra que el inactivo no lo recibira.
    await new Promise((resolve) => setTimeout(resolve, SILENCE_MS));
    expect(inactiveSub.events.filter((id) => sent.includes(id))).toEqual([]);

    await Promise.all([admin.removeChannel(adminSub.channel), inactive.removeChannel(inactiveSub.channel)]);
  });
});
