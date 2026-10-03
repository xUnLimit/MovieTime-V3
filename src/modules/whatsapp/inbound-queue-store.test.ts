import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn() }));

import { createInboundQueueStore } from './inbound-queue-store';

const row = {
  id: 'row-1', wa_message_id: 'wamid.1', phone_number_id: '1', from_wa_id: '50760000000', contact_name: null,
  message_type: 'text', text_body: 'Hola', sent_at: '2026-10-03T12:00:00Z', media_id: null, media_mime_type: null,
  media_filename: null, context_wa_message_id: null, reaction_emoji: null, payload: {},
};

describe('inbound queue store', () => {
  it('maps claimed rows to inbound messages', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row], error: null });
    const store = createInboundQueueStore({ rpc } as never);
    const [claimed] = await store.claim(10, 300);
    expect(rpc).toHaveBeenCalledWith('claim_whatsapp_inbound_batch', { p_limit: 10, p_lock_seconds: 300 });
    expect(claimed.id).toBe('row-1');
    expect(claimed.message).toMatchObject({ waMessageId: 'wamid.1', fromWaId: '50760000000', textBody: 'Hola' });
  });

  it('returns an empty list when nothing is claimed', async () => {
    const store = createInboundQueueStore({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) } as never);
    await expect(store.claim(10, 300)).resolves.toEqual([]);
  });

  it('finishes with a label or null and surfaces errors without SQL detail', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { code: '42501', message: 'secret' } });
    const store = createInboundQueueStore({ rpc } as never);
    await store.finish('row-1', null);
    expect(rpc).toHaveBeenCalledWith('finish_whatsapp_inbound', { p_id: 'row-1', p_error: null });
    await expect(store.finish('row-1', 'BOT_ERROR')).rejects.toThrow('Inbound queue finish failed: 42501');
  });

  it('throws when the claim fails', async () => {
    const store = createInboundQueueStore({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'XX000' } }) } as never);
    await expect(store.claim(1, 60)).rejects.toThrow('Inbound queue claim failed: XX000');
  });
});
