import { beforeEach, describe, expect, it, vi } from 'vitest';

const result = vi.hoisted(() => ({ value: { data: null as unknown, error: null as unknown } }));
const calls = vi.hoisted(() => [] as Array<{ method: string; args: unknown[] }>);

vi.mock('./client', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['from', 'select', 'eq', 'order', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.upsert = async (...args: unknown[]) => {
    calls.push({ method: 'upsert', args });
    return { error: result.value.error };
  };
  builder.rpc = async (...args: unknown[]) => {
    calls.push({ method: 'rpc', args });
    return { error: result.value.error };
  };
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result.value).then(resolve);
  return { supabase: builder };
});

import {
  hideWhatsAppMessage,
  listWhatsAppConversations,
  listWhatsAppMessages,
  markWhatsAppConversationRead,
  markWhatsAppConversationUnread,
} from './whatsapp-chat-repository';

beforeEach(() => {
  calls.length = 0;
  result.value = { data: null, error: null };
});

describe('whatsapp chat repository', () => {
  it('maps conversation rows and skips rows without identity', async () => {
    result.value.data = [
      {
        wa_id: '507', contact_name: 'Mary', tercero_id: 't1', tercero_nombre: 'María', last_direction: 'outbound',
        last_preview: 'Hola', last_message_at: '2026-09-27T12:00:00Z', last_inbound_at: null, unread_count: 3,
        proxima_fecha_fin: '2026-09-30',
      },
      { wa_id: '508', contact_name: null, tercero_id: null, tercero_nombre: null, last_direction: 'inbound',
        last_preview: null, last_message_at: '2026-09-27T11:00:00Z', last_inbound_at: '2026-09-27T11:00:00Z', unread_count: null, proxima_fecha_fin: null },
      { wa_id: null, last_message_at: '2026-09-27T10:00:00Z' },
    ];

    await expect(listWhatsAppConversations()).resolves.toEqual([
      {
        waId: '507', contactName: 'Mary', terceroId: 't1', terceroNombre: 'María', lastDirection: 'outbound',
        lastPreview: 'Hola', lastMessageAt: '2026-09-27T12:00:00Z', lastInboundAt: null, unreadCount: 3,
        nextExpiry: '2026-09-30',
      },
      {
        waId: '508', contactName: null, terceroId: null, terceroNombre: null, lastDirection: 'inbound',
        lastPreview: '', lastMessageAt: '2026-09-27T11:00:00Z', lastInboundAt: '2026-09-27T11:00:00Z', unreadCount: 0,
        nextExpiry: null,
      },
    ]);
    expect(calls).toContainEqual({ method: 'from', args: ['v_whatsapp_conversations'] });
  });

  it('returns messages oldest first for one conversation', async () => {
    result.value.data = [
      { id: 'm2', direction: 'outbound', message_kind: 'template', text_body: null, template_name: 'vence_hoy', occurred_at: '2026-09-27T12:00:00Z', status: null },
      { id: 'm1', direction: 'inbound', message_kind: null, text_body: 'Hola', template_name: null, occurred_at: '2026-09-27T11:00:00Z', status: 'received' },
      { id: null, occurred_at: null },
    ];

    const messages = await listWhatsAppMessages('507', 50);

    expect(messages.map((message) => message.id)).toEqual(['m1', 'm2']);
    expect(messages[0]).toMatchObject({ direction: 'inbound', kind: 'text' });
    expect(messages[1]).toMatchObject({ direction: 'outbound', status: 'pending' });
    expect(calls).toContainEqual({ method: 'eq', args: ['wa_id', '507'] });
    expect(calls).toContainEqual({ method: 'limit', args: [50] });
  });

  it('handles empty results', async () => {
    await expect(listWhatsAppConversations()).resolves.toEqual([]);
    await expect(listWhatsAppMessages('507')).resolves.toEqual([]);
  });

  it('propagates read errors', async () => {
    result.value.error = new Error('rls');
    await expect(listWhatsAppConversations()).rejects.toThrow('rls');
    await expect(listWhatsAppMessages('507')).rejects.toThrow('rls');
  });

  it('upserts the read marker and propagates write errors', async () => {
    await markWhatsAppConversationRead('507', '2026-09-27T12:00:00Z');
    expect(calls).toContainEqual({
      method: 'upsert',
      args: [{ wa_id: '507', last_read_at: '2026-09-27T12:00:00Z' }, { onConflict: 'wa_id' }],
    });

    result.value.error = new Error('denied');
    await expect(markWhatsAppConversationRead('507', 'x')).rejects.toThrow('denied');
  });

  it('marks a conversation unread by moving the marker just before the last inbound message', async () => {
    await markWhatsAppConversationUnread('507', '2026-09-27T12:00:00.000Z');

    expect(calls).toContainEqual({
      method: 'upsert',
      args: [{ wa_id: '507', last_read_at: '2026-09-27T11:59:59.999Z' }, { onConflict: 'wa_id' }],
    });
  });

  it('hides a message via RPC with a validated UUID and propagates write errors', async () => {
    const messageId = '11111111-1111-4111-8111-111111111111';
    await hideWhatsAppMessage(messageId, 'inbound');
    expect(calls).toContainEqual({
      method: 'rpc',
      args: ['hide_whatsapp_message', { p_message_id: messageId, p_direction: 'inbound' }],
    });

    result.value.error = new Error('forbidden');
    await expect(hideWhatsAppMessage(messageId, 'outbound')).rejects.toThrow('forbidden');
  });

  it('rejects a non-UUID message id before calling the RPC', async () => {
    await expect(hideWhatsAppMessage('not-a-uuid', 'inbound')).rejects.toThrow();
    expect(calls.some((call) => call.method === 'rpc')).toBe(false);
  });
});
