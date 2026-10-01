import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createUserClient } from '@/test/integration/clients';
import { requireIntegrationEnv } from '@/test/integration/env';
import { FixtureScope, isoDate, newUuid, uniqueId, uniqueWaId, unwrap, type Catalog, type TestUser, type TestVenta } from '@/test/integration/fixtures';

type Notice = { id: string; status: string; dedupe_key: string };

describe.skipIf(requireIntegrationEnv() === null)('integracion: avisos y bandeja de WhatsApp', () => {
  const scope = new FixtureScope();
  let admin: SupabaseClient;
  let operator: SupabaseClient;
  let adminUser: TestUser;
  let catalog: Catalog;
  let venta: TestVenta;

  const reserve = (dedupeKey: string, origin: 'manual' | 'auto', waId: string) =>
    scope.service.rpc('reserve_whatsapp_notice', {
      p_dedupe_key: dedupeKey,
      p_tipo: 'notificacion_regular',
      p_tercero_id: catalog.terceroId,
      p_wa_id: waId,
      p_channel: 'template',
      p_meta_template_name: null,
      p_fecha_vencimiento: isoDate(3),
      p_origin: origin,
      p_idempotency_key: newUuid(),
      p_created_by: adminUser.id,
      p_venta_ids: [venta.ventaId],
    });
  const conversation = async (client: SupabaseClient, waId: string) => {
    const filas = unwrap(await client.from('v_whatsapp_conversations').select('*').eq('wa_id', waId), 'v_whatsapp_conversations');
    return filas[0] as Record<string, unknown> | undefined;
  };
  const inbound = async (waId: string, sentAt: Date, type = 'text') =>
    unwrap(
      await scope.service
        .from('whatsapp_inbound_messages')
        .insert({ wa_message_id: uniqueId('wamid'), phone_number_id: 'fixture', from_wa_id: waId, message_type: type, text_body: 'hola', sent_at: sentAt.toISOString() })
        .select('id'),
      'mensaje entrante'
    );

  beforeAll(async () => {
    adminUser = await scope.createUser({ role: 'admin' });
    const operatorUser = await scope.createUser({ role: 'operador' });
    admin = await createUserClient(adminUser.email, adminUser.password);
    operator = await createUserClient(operatorUser.email, operatorUser.password);
    catalog = await scope.createCatalog();
    venta = await scope.createVenta(admin, catalog);
  });

  afterAll(async () => {
    await Promise.all([admin, operator].map((client) => client?.auth.signOut()));
    await scope.cleanup();
  });

  describe('reserve_whatsapp_notice', () => {
    it('reservas simultaneas con el mismo dedupe_key dejan una sola fila y un solo vinculo con la venta', async () => {
      const dedupeKey = uniqueId('dedupe');
      const waId = scope.trackWaId(uniqueWaId());

      const resultados = await Promise.all(Array.from({ length: 5 }, () => reserve(dedupeKey, 'manual', waId)));
      const avisos = resultados.map((resultado, index) => unwrap<Notice>(resultado, `reserva ${index}`));

      expect(new Set(avisos.map((aviso) => aviso.id)).size).toBe(1);
      expect(avisos[0]).toMatchObject({ status: 'pending', dedupe_key: dedupeKey });
      const filas = unwrap(await scope.service.from('whatsapp_notices').select('id').eq('dedupe_key', dedupeKey), 'avisos');
      expect(filas).toHaveLength(1);
      const vinculos = unwrap(await scope.service.from('whatsapp_notice_ventas').select('venta_id').eq('notice_id', avisos[0].id), 'vinculos');
      expect(vinculos).toEqual([{ venta_id: venta.ventaId }]);
    });

    it('solo un reintento manual reclama un aviso fallido; el automatico lo deja como esta', async () => {
      const dedupeKey = uniqueId('dedupe');
      const waId = scope.trackWaId(uniqueWaId());
      const primero = unwrap<Notice>(await reserve(dedupeKey, 'manual', waId), 'reserva inicial');
      unwrap(await scope.service.from('whatsapp_notices').update({ status: 'failed' }).eq('id', primero.id).select('id'), 'marcar fallido');

      const automatico = unwrap<Notice>(await reserve(dedupeKey, 'auto', waId), 'reserva automatica');
      expect(automatico).toMatchObject({ id: primero.id, status: 'failed' });

      const manual = unwrap<Notice>(await reserve(dedupeKey, 'manual', waId), 'reserva manual');
      expect(manual).toMatchObject({ id: primero.id, status: 'pending' });
      const filas = unwrap(await scope.service.from('whatsapp_notices').select('id').eq('dedupe_key', dedupeKey), 'avisos');
      expect(filas).toHaveLength(1);
    });

    it('no es ejecutable por usuarios autenticados', async () => {
      const respuesta = await admin.rpc('reserve_whatsapp_notice', {
        p_dedupe_key: uniqueId('dedupe'),
        p_tipo: 'notificacion_regular',
        p_tercero_id: catalog.terceroId,
        p_wa_id: uniqueWaId(),
        p_channel: 'template',
        p_meta_template_name: null,
        p_fecha_vencimiento: null,
        p_origin: 'manual',
        p_idempotency_key: newUuid(),
        p_created_by: null,
        p_venta_ids: [venta.ventaId],
      });
      expect(respuesta.error).not.toBeNull();
    });
  });

  describe('v_whatsapp_conversations', () => {
    it('calcula no leidos con whatsapp_conversation_reads', async () => {
      const waId = scope.trackWaId(uniqueWaId());
      const base = Date.now() - 60 * 60 * 1000;
      await inbound(waId, new Date(base));
      expect(await conversation(admin, waId)).toMatchObject({ last_direction: 'inbound', unread_count: 1, pinned_at: null, archived: false });

      unwrap(await admin.from('whatsapp_conversation_reads').upsert({ wa_id: waId, last_read_at: new Date(base + 60_000).toISOString() }).select('wa_id'), 'marcar leido');
      expect(await conversation(admin, waId)).toMatchObject({ unread_count: 0 });

      await inbound(waId, new Date(base + 120_000));
      await inbound(waId, new Date(base + 130_000), 'reaction');
      // Las reacciones no cuentan como no leidos.
      expect(await conversation(admin, waId)).toMatchObject({ unread_count: 1 });
    });

    it('fija con pinned_at y archiva hasta que llega un mensaje entrante posterior', async () => {
      const waId = scope.trackWaId(uniqueWaId());
      const base = Date.now() - 60 * 60 * 1000;
      await inbound(waId, new Date(base));

      const pinnedAt = new Date(base + 60_000).toISOString();
      unwrap(await admin.from('whatsapp_conversation_flags').upsert({ wa_id: waId, pinned_at: pinnedAt }).select('wa_id'), 'fijar');
      expect(await conversation(admin, waId)).toMatchObject({ archived: false });
      expect(new Date(String((await conversation(admin, waId))?.pinned_at)).toISOString()).toBe(pinnedAt);

      const archivedAt = new Date(base + 180_000).toISOString();
      unwrap(await admin.from('whatsapp_conversation_flags').upsert({ wa_id: waId, pinned_at: pinnedAt, archived_at: archivedAt }).select('wa_id'), 'archivar');
      expect(await conversation(admin, waId)).toMatchObject({ archived: true });

      // Un mensaje saliente posterior NO la desarchiva.
      unwrap(
        await scope.service
          .from('whatsapp_outbound_messages')
          .insert({ idempotency_key: newUuid(), to_wa_id: waId, message_kind: 'text', text_body: 'respuesta', send_status: 'accepted', created_at: new Date(base + 200_000).toISOString() })
          .select('id'),
        'mensaje saliente'
      );
      expect(await conversation(admin, waId)).toMatchObject({ archived: true, last_direction: 'outbound' });

      // Un mensaje entrante posterior si; la marca archived_at de la fila no se toca.
      await inbound(waId, new Date(base + 240_000));
      expect(await conversation(admin, waId)).toMatchObject({ archived: false });
      const flag = unwrap<Record<string, unknown>>(await scope.service.from('whatsapp_conversation_flags').select('archived_at').eq('wa_id', waId).single(), 'flag');
      expect(flag.archived_at).not.toBeNull();
    });

    it('solo los administradores activos ven conversaciones', async () => {
      const waId = scope.trackWaId(uniqueWaId());
      await inbound(waId, new Date());

      expect(await conversation(admin, waId)).toBeDefined();
      const comoOperador = await operator.from('v_whatsapp_conversations').select('wa_id').eq('wa_id', waId);
      expect(comoOperador.data ?? []).toHaveLength(0);
    });
  });
});
