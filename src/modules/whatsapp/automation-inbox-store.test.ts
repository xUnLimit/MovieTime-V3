import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn() }));
import { createAutomationInboxStore } from './automation-inbox-store';

const token = randomUUID();
const claimRow = { id: 1, attempts: 2, token, fence: 7,
  conversation: { wa_id: '50760000000', flow_version: 1, context: {}, active_process: 'buy', order_id: null },
  message: { wa_message_id: 'wamid.IN', from_wa_id: '50760000000', phone_number_id: '123', contact_name: null,
    message_type: 'text', text_body: 'catalogo', sent_at: '2026-10-03T12:00:00Z', media_id: null,
    media_mime_type: null, media_filename: null, context_wa_message_id: null, reaction_emoji: null, payload: {} },
};
function store() {
  const rpc = vi.fn().mockResolvedValue({ data: claimRow, error: null });
  return { rpc, instance: createAutomationInboxStore({ rpc } as never) };
}
describe('automation inbox adapter', () => {
  it('validates persisted envelope and maps it to the existing inbound contract', async () => {
    const s = store(); const claim = await s.instance.claim();
    expect(claim).toMatchObject({ attempts: 2, token, fence: 7, message: { waMessageId: 'wamid.IN', textBody: 'catalogo' },
      conversation: { waId: '50760000000', flowVersion: 1, activeProcess: 'buy' } });
    expect(s.rpc).toHaveBeenCalledWith('claim_whatsapp_automation', { p_lease_seconds: 90 });
    s.rpc.mockResolvedValue({ data: null, error: null });
    expect(await s.instance.claim()).toBeNull();
    s.rpc.mockResolvedValue({ data: { ...claimRow, token: 'invalid' }, error: null });
    await expect(s.instance.claim()).rejects.toThrow();
  });
  it('uses the same lease and fence for pre-send checks, checkpoints and completion', async () => {
    const s = store(); const claim = (await s.instance.claim())!;
    s.rpc.mockResolvedValue({ data: true, error: null });
    expect(await s.instance.isCurrent(claim)).toBe(true);
    expect(await s.instance.checkpoint(claim, { stage: 'buy' }, 'buy', null, 1)).toBe(true);
    expect(await s.instance.finish(claim, { outcome: 'done', context: { stage: 'buy' }, process: 'buy' })).toBe(true);
    expect(s.rpc).toHaveBeenCalledWith('check_whatsapp_automation_lease', { p_wa_id: '50760000000', p_token: token, p_fence: 7 });
    expect(s.rpc).toHaveBeenCalledWith('checkpoint_whatsapp_automation', expect.objectContaining({ p_token: token, p_fence: 7, p_context: { stage: 'buy' } }));
    expect(s.rpc).toHaveBeenCalledWith('finish_whatsapp_automation', expect.objectContaining({ p_id: 1, p_token: token, p_fence: 7, p_outcome: 'done' }));
    s.rpc.mockResolvedValue({ data: false, error: null });
    expect(await s.instance.isCurrent(claim)).toBe(false);
    expect(await s.instance.checkpoint(claim, {}, null, null, null)).toBe(false);
    expect(await s.instance.finish(claim, { outcome: 'retry' })).toBe(false);
  });
  it('propagates storage errors without leaking database details', async () => {
    const s = store(); const claim = (await s.instance.claim())!;
    s.rpc.mockResolvedValue({ data: null, error: { message: 'sensitive database failure' } });
    await expect(s.instance.claim()).rejects.toThrow('Automation inbox claim failed');
    await expect(s.instance.isCurrent(claim)).rejects.toThrow('Automation lease check failed');
    await expect(s.instance.checkpoint(claim, {}, null, null, null)).rejects.toThrow('Automation context checkpoint failed');
    await expect(s.instance.finish(claim, { outcome: 'done' })).rejects.toThrow('Automation inbox completion failed');
  });
});
