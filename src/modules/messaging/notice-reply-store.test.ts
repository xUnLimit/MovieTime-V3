import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn() }));

import { createNoticeReplyStore } from './notice-reply-store';

function fakeClient(
  rpcResults: Record<string, { data: unknown; error: { code: string } | null }>,
  tableResults: Record<string, { data: unknown; error: { code: string } | null }> = {}
) {
  const rpc = vi.fn(async (name: string) => rpcResults[name] ?? { data: null, error: null });
  const calls: Array<{ table: string; method: string }> = [];
  const client = { rpc, from: (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'or', 'update']) {
      builder[method] = () => { calls.push({ table, method }); return builder; };
    }
    builder.maybeSingle = async () => tableResults[table] ?? { data: null, error: null };
    builder.then = (resolve: (value: unknown) => void) => resolve(tableResults[table] ?? { data: null, error: null });
    return builder;
  } };
  return { client: client as never, rpc, calls };
}

describe('createNoticeReplyStore', () => {
  it.each(['claimed', 'duplicate', 'busy', 'exhausted', 'uncertain'] as const)
  ('mapea el resultado atomico %s', async (outcome) => {
    const { client, rpc } = fakeClient({ claim_whatsapp_notice_reply: {
      data: [{ reply_id: 42, attempts: 2, outcome }], error: null,
    } });
    await expect(createNoticeReplyStore(client).claim('123e4567-e89b-12d3-a456-426614174000', 'RENOVAR', 'wamid.IN'))
      .resolves.toEqual({ id: 42, attempts: 2, outcome });
    expect(rpc).toHaveBeenCalledWith('claim_whatsapp_notice_reply', expect.objectContaining({ p_action: 'RENOVAR' }));
  });

  it('cierra con el numero de intento para no pisar otro lease', async () => {
    const { client, rpc } = fakeClient({ finish_whatsapp_notice_reply: { data: true, error: null } });
    await expect(createNoticeReplyStore(client).finish(42, 2, 'failed', 'SEND_REJECTED')).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('finish_whatsapp_notice_reply', {
      p_reply_id: 42, p_attempt: 2, p_result: 'failed', p_error_label: 'SEND_REJECTED',
    });
  });

  it('devuelve error controlado si falla el claim', async () => {
    const { client } = fakeClient({ claim_whatsapp_notice_reply: { data: null, error: { code: '42501' } } });
    await expect(createNoticeReplyStore(client).claim('123e4567-e89b-12d3-a456-426614174000', 'DATOS', 'wamid.IN'))
      .rejects.toThrow('Notice reply store claim action failed: 42501');
  });

  it('lee el aviso y sus ventas', async () => {
    const { client } = fakeClient({}, {
      whatsapp_notices: { data: { id: 'notice-1' }, error: null },
      whatsapp_notice_ventas: { data: [{ venta_id: 'sale-1' }], error: null },
    });
    const store = createNoticeReplyStore(client);
    await expect(store.findNotice('notice-1')).resolves.toMatchObject({ id: 'notice-1' });
    await expect(store.ventaIds('notice-1')).resolves.toEqual(['sale-1']);
  });

  it('marca ventas solo si aun no estaban rechazadas', async () => {
    const { client, calls } = fakeClient({}, { ventas: { data: [{ id: 'sale-1' }], error: null } });
    await expect(createNoticeReplyStore(client).declineVentas(['sale-1'], '2026-09-30T00:00:00Z')).resolves.toBe(true);
    expect(calls).toContainEqual({ table: 'ventas', method: 'or' });
  });

  it('reconstruye mensajes entrantes de la cola', async () => {
    const { client } = fakeClient({ list_retryable_whatsapp_notice_replies: {
      data: [{ inbound_wa_message_id: 'wamid.IN' }], error: null,
    } }, { whatsapp_inbound_messages: { data: [{
      wa_message_id: 'wamid.IN', phone_number_id: '123', from_wa_id: '50760000000',
      contact_name: null, message_type: 'button', text_body: null,
      sent_at: '2026-09-30T00:00:00Z', media_id: null, media_mime_type: null,
      media_filename: null, context_wa_message_id: null, reaction_emoji: null,
      payload: { type: 'template_button', payload: 'RENOVAR:123e4567-e89b-12d3-a456-426614174000' },
    }], error: null } });
    await expect(createNoticeReplyStore(client).listRetryable(25)).resolves.toEqual([
      expect.objectContaining({ waMessageId: 'wamid.IN', messageType: 'button' }),
    ]);
  });

  it('no consulta el inbox sin filas reintentables', async () => {
    const { client, calls } = fakeClient({ list_retryable_whatsapp_notice_replies: { data: [], error: null } });
    await expect(createNoticeReplyStore(client).listRetryable(25)).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });

  it('interpreta una respuesta vacia del RPC como error', async () => {
    const { client } = fakeClient({ claim_whatsapp_notice_reply: { data: [], error: null } });
    await expect(createNoticeReplyStore(client).claim('123e4567-e89b-12d3-a456-426614174000', 'DATOS', 'wamid.IN'))
      .rejects.toThrow('returned no row');
  });

  it('rechaza un estado desconocido del RPC', async () => {
    const { client } = fakeClient({ claim_whatsapp_notice_reply: {
      data: [{ reply_id: 42, attempts: 1, outcome: 'unexpected' }], error: null,
    } });
    await expect(createNoticeReplyStore(client).claim('123e4567-e89b-12d3-a456-426614174000', 'DATOS', 'wamid.IN'))
      .rejects.toThrow('returned no row');
  });

  it('informa fallos de lectura del inbox sin datos del mensaje', async () => {
    const { client } = fakeClient({ list_retryable_whatsapp_notice_replies: {
      data: [{ inbound_wa_message_id: 'wamid.IN' }], error: null,
    } }, { whatsapp_inbound_messages: { data: null, error: { code: '42501' } } });
    await expect(createNoticeReplyStore(client).listRetryable(25)).rejects.toThrow('42501');
  });

  it('devuelve false si el lease ya fue tomado por otro intento', async () => {
    const { client } = fakeClient({ finish_whatsapp_notice_reply: { data: false, error: null } });
    await expect(createNoticeReplyStore(client).finish(42, 1, 'accepted')).resolves.toBe(false);
  });
});
