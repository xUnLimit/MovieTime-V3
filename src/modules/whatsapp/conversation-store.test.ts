import { beforeEach, describe, it, expect, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn(), createUserRequestClient: () => ({ rpc }) }));
import { createConversationStore, resolveConversationReview, setConversationMode } from './conversation-store';
const waId = '50760000000';
const input = { waId, mode: 'human', version: 7 };
beforeEach(() => rpc.mockReset());
function store(data: unknown, error: unknown = null) {
  const eq = vi.fn().mockReturnValue({ maybeSingle: async () => ({ data, error }) });
  const from = vi.fn().mockReturnValue({ select: () => ({ eq }) });
  return { instance: createConversationStore({ from } as never), eq };
}
describe('conversation persistence', () => {
  it('reads only the requested contact and validates control fields', async () => {
    const s = store({ wa_id: waId, mode: 'human', version: 7, operator_id: null,
      active_process: 'renew', order_id: null, handoff_reason: 'operator' });
    expect(await s.instance.get(waId)).toMatchObject({ waId, mode: 'human', version: 7 });
    expect(s.eq).toHaveBeenCalledWith('wa_id', waId);
    expect(await store(null).instance.get(waId)).toMatchObject({ mode: 'bot', version: 0 });
    await expect(store(null, { message: 'internal' }).instance.get(waId)).rejects.toThrow('Conversation lookup failed');
    await expect(store({ wa_id: waId, mode: 'invalid' }).instance.get(waId)).rejects.toThrow();
  });
  it('delegates authorized CAS and manual resolution to their SQL commands', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await setConversationMode('Bearer fixture', input)).toBe(true);
    expect(rpc).toHaveBeenCalledWith('set_whatsapp_conversation_mode', { p_wa_id: waId, p_mode: 'human', p_version: 7 });
    expect(await resolveConversationReview('Bearer fixture', input)).toBe(true);
    expect(rpc).toHaveBeenCalledWith('resolve_whatsapp_automation_review', { p_wa_id: waId, p_version: 7 });
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await setConversationMode('Bearer fixture', input)).toBe(false);
    expect(await resolveConversationReview('Bearer fixture', input)).toBe(false);
    rpc.mockResolvedValue({ data: null, error: { message: 'internal' } });
    await expect(setConversationMode('Bearer fixture', input)).rejects.toThrow('Conversation control failed');
    await expect(resolveConversationReview('Bearer fixture', input)).rejects.toThrow('Conversation review resolution failed');
  });
});
