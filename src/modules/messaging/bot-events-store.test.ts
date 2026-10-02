import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn() }));

import { createBotEventsStore, sanitizeEventDetail } from './bot-events-store';

function fakeClient(error: { code?: string } | null = null) {
  const rpc = vi.fn(async () => ({ data: null, error }));
  return { client: { rpc } as never, rpc };
}

describe('sanitizeEventDetail', () => {
  it('keeps short plain facts', () => {
    expect(sanitizeEventDetail({ kind: 'login', minutes: 5, matched: true, extra: null, note: '  hola  ' }))
      .toEqual({ kind: 'login', minutes: 5, matched: true, extra: null, note: 'hola' });
  });

  it('drops keys that could carry credentials, codes or links', () => {
    const detail = sanitizeEventDetail({
      code: '123456', password: 'x', api_token: 'x', travel_link: 'x', url: 'x', mail_key: 'x', secret: 'x', ok: 1,
    });
    expect(detail).toEqual({ ok: 1 });
  });

  it('drops values that look like codes or URLs, malformed keys and non-finite numbers', () => {
    const detail = sanitizeEventDetail({
      a: '123456', b: 'https://netflix.example/verify?x=1', 'Bad Key': 'x', c: Number.NaN, d: { nested: 1 }, e: 'ok',
    });
    expect(detail).toEqual({ e: 'ok' });
  });

  it('bounds the length of values and the number of keys', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`field_${index}`, index]));
    expect(Object.keys(sanitizeEventDetail(many))).toHaveLength(20);
    expect(sanitizeEventDetail({ note: 'x'.repeat(500) }).note).toHaveLength(120);
    expect(sanitizeEventDetail(undefined)).toEqual({});
  });
});

describe('createBotEventsStore.record', () => {
  it('inserts through the RPC with sanitized detail and bounded identifiers', async () => {
    const { client, rpc } = fakeClient();
    await createBotEventsStore(client).record({
      waId: '5'.repeat(40), clienteId: 'c1', type: 'code_sent', nodeId: 'n'.repeat(80), optionId: 'login',
      detail: { minutes: 5, code: '123456' },
    });
    expect(rpc).toHaveBeenCalledWith('record_whatsapp_bot_event', {
      p_wa_id: '5'.repeat(32), p_cliente_id: 'c1', p_type: 'code_sent', p_node_id: 'n'.repeat(64),
      p_option_id: 'login', p_detail: { minutes: 5 },
    });
  });

  it('defaults optional fields to null and an empty detail', async () => {
    const { client, rpc } = fakeClient();
    await createBotEventsStore(client).record({ waId: '50760000001', type: 'menu_shown' });
    expect(rpc).toHaveBeenCalledWith('record_whatsapp_bot_event', {
      p_wa_id: '50760000001', p_cliente_id: null, p_type: 'menu_shown', p_node_id: null, p_option_id: null, p_detail: {},
    });
  });

  it('reports only the error code when the insert fails', async () => {
    const { client } = fakeClient({ code: '23514' });
    await expect(createBotEventsStore(client).record({ waId: '1', type: 'error' }))
      .rejects.toThrow('Bot events store record failed: 23514');
    const unknown = fakeClient({});
    await expect(createBotEventsStore(unknown.client).record({ waId: '1', type: 'error' }))
      .rejects.toThrow('failed: unknown');
  });
});
