import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({
  createServiceRoleClient: vi.fn(),
}));

import { createOutboundStore } from './outbound-store';

type Result = { data?: unknown; error?: { code: string } | null };

// Constructor de consultas minimo: registra cada llamada y resuelve con el
// resultado configurado para la tabla.
function fakeClient(results: Record<string, Result>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      const result = { data: results[table]?.data ?? null, error: results[table]?.error ?? null };
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'not']) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.maybeSingle = async () => result;
      builder.single = async () => result;
      builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
      return builder;
    },
  };
  return { client: client as never, calls };
}

const row = { id: 'out-1', send_status: 'accepted', wa_message_id: 'wamid.OUT', error_title: null };

describe('createOutboundStore', () => {
  it('stores a redacted credential body while leaving the send payload intact', async () => {
    const { client, calls } = fakeClient({ whatsapp_outbound_messages: { data: row } });
    const message = {
      idempotencyKey: 'k3', toWaId: '50760000000', sentBy: null,
      payload: { kind: 'text' as const, text: 'Clave vigente: secreto-del-test' },
      storedTextBody: '[Credenciales enviadas]',
    };
    await createOutboundStore(client).insertPending(message);
    const insert = calls.find((call) => call.method === 'insert')?.args[0];
    expect(insert).toMatchObject({ text_body: '[Credenciales enviadas]', sent_by: null, payload: {} });
    expect(JSON.stringify(insert)).not.toContain('secreto-del-test');
    expect(message.payload.text).toContain('secreto-del-test');
  });
  it('maps an existing idempotency key to a record', async () => {
    const { client, calls } = fakeClient({ whatsapp_outbound_messages: { data: row } });

    await expect(createOutboundStore(client).findByIdempotencyKey('key-1')).resolves.toEqual({
      id: 'out-1', sendStatus: 'accepted', waMessageId: 'wamid.OUT', errorTitle: null,
    });
    expect(calls).toContainEqual({ table: 'whatsapp_outbound_messages', method: 'eq', args: ['idempotency_key', 'key-1'] });
  });

  it('returns null when the key is unused and reads the last inbound time', async () => {
    const { client } = fakeClient({ whatsapp_inbound_messages: { data: { sent_at: '2026-09-27T11:00:00Z' } } });
    const store = createOutboundStore(client);

    await expect(store.findByIdempotencyKey('key-2')).resolves.toBeNull();
    await expect(store.lastInboundAt('50760000000')).resolves.toBe('2026-09-27T11:00:00Z');
  });

  it('returns null for a customer that never wrote', async () => {
    const { client } = fakeClient({});

    await expect(createOutboundStore(client).lastInboundAt('50760000000')).resolves.toBeNull();
  });

  it('inserts text and template rows with their payload columns', async () => {
    const { client, calls } = fakeClient({ whatsapp_outbound_messages: { data: { ...row, send_status: 'pending' } } });
    const store = createOutboundStore(client);

    await store.insertPending({ idempotencyKey: 'k1', toWaId: '507', payload: { kind: 'text', text: 'Hola' }, sentBy: 'u1' });
    await store.insertPending({
      idempotencyKey: 'k2', toWaId: '507', sentBy: 'u1',
      payload: { kind: 'template', templateName: 'vence_hoy', params: ['a', 'b', 'c'], buttonPayloads: ['RENOVAR:id'] },
    });

    const inserts = calls.filter((call) => call.method === 'insert').map((call) => call.args[0]);
    expect(inserts).toEqual([
      expect.objectContaining({ message_kind: 'text', text_body: 'Hola', template_name: null, template_params: [], sent_by: 'u1' }),
      expect.objectContaining({ message_kind: 'template', text_body: null, template_name: 'vence_hoy',
        template_params: ['a', 'b', 'c'], payload: { buttonPayloads: ['RENOVAR:id'] } }),
    ]);
  });

  it('signals a concurrent reservation with null on unique violations', async () => {
    const { client } = fakeClient({ whatsapp_outbound_messages: { error: { code: '23505' } } });

    await expect(createOutboundStore(client).insertPending({
      idempotencyKey: 'k1', toWaId: '507', payload: { kind: 'text', text: 'Hola' }, sentBy: 'u1',
    })).resolves.toBeNull();
  });

  it('updates accepted and failed messages', async () => {
    const { client, calls } = fakeClient({});
    const store = createOutboundStore(client);

    await store.markAccepted('out-1', 'wamid.OUT');
    await store.markFailed('out-2', 131026, 'Message undeliverable');

    expect(calls.filter((call) => call.method === 'update').map((call) => call.args[0])).toEqual([
      { send_status: 'accepted', wa_message_id: 'wamid.OUT' },
      { send_status: 'failed', error_code: 131026, error_title: 'Message undeliverable' },
    ]);
  });

  it('reserva de nuevo solo una salida fallida con codigo explicito', async () => {
    const { client, calls } = fakeClient({ whatsapp_outbound_messages: { data: { id: 'out-1' } } });
    await expect(createOutboundStore(client).retryFailed('out-1')).resolves.toBe(true);
    expect(calls).toContainEqual({ table: 'whatsapp_outbound_messages', method: 'not', args: ['error_code', 'is', null] });
  });

  it.each([
    ['findByIdempotencyKey', (store: ReturnType<typeof createOutboundStore>) => store.findByIdempotencyKey('k'), 'whatsapp_outbound_messages'],
    ['lastInboundAt', (store: ReturnType<typeof createOutboundStore>) => store.lastInboundAt('507'), 'whatsapp_inbound_messages'],
    ['insertPending', (store: ReturnType<typeof createOutboundStore>) => store.insertPending({
      idempotencyKey: 'k', toWaId: '507', payload: { kind: 'text', text: 'x' }, sentBy: 'u',
    }), 'whatsapp_outbound_messages'],
    ['markAccepted', (store: ReturnType<typeof createOutboundStore>) => store.markAccepted('id', 'w'), 'whatsapp_outbound_messages'],
    ['markFailed', (store: ReturnType<typeof createOutboundStore>) => store.markFailed('id', null, 't'), 'whatsapp_outbound_messages'],
  ])('throws a controlled error when %s fails', async (_label, run, table) => {
    const { client } = fakeClient({ [table]: { error: { code: '42501' } } });

    await expect(run(createOutboundStore(client))).rejects.toThrow(/42501/);
  });
});
