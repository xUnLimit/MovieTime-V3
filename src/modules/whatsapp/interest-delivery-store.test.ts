import { beforeEach, describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: () => ({ rpc }) }));
import { createInterestDeliveryStore } from './interest-delivery-store';
const id = '11111111-1111-4111-8111-111111111111';
const claim = { id, contact: '50760000001', name: 'Netflix', token: id, fence: 3, attempts: 1 };
beforeEach(() => rpc.mockReset());
describe('fenced interest adapter', () => {
  it('separates automatic and manual claims and validates the recorded recipient', async () => {
    rpc.mockResolvedValue({ data: claim, error: null });
    expect(await createInterestDeliveryStore().claim()).toEqual(claim);
    expect(rpc).toHaveBeenLastCalledWith('mt_claim_automatic_interest', { p_id: null, p_manual: false });
    expect(await createInterestDeliveryStore(id).claim()).toEqual(claim);
    expect(rpc).toHaveBeenLastCalledWith('mt_claim_automatic_interest', { p_id: id, p_manual: true });
    rpc.mockResolvedValue({ data: null, error: null }); expect(await createInterestDeliveryStore().claim()).toBeNull();
    rpc.mockResolvedValue({ data: { ...claim, contact: 'other' }, error: null });
    await expect(createInterestDeliveryStore().claim()).rejects.toThrow();
  });
  it('propagates current fence and correlates accepted delivery with an outbound record', async () => {
    const store = createInterestDeliveryStore(); rpc.mockResolvedValue({ data: true, error: null });
    expect(await store.current(claim)).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith('mt_check_interest_delivery', { p_id: id, p_token: id, p_fence: 3 });
    expect(await store.finish(claim, 'accepted', id)).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith('mt_finish_automatic_interest', { p_id: id, p_token: id,
      p_fence: 3, p_result: 'accepted', p_outbound_id: id });
    rpc.mockResolvedValue({ data: false, error: null }); expect(await store.current(claim)).toBe(false);
    expect(await store.finish(claim, 'review')).toBe(false);
    expect(rpc).toHaveBeenLastCalledWith('mt_finish_automatic_interest', expect.objectContaining({ p_outbound_id: null }));
  });
  it('fails closed on SQL errors', async () => {
    const store = createInterestDeliveryStore(); rpc.mockResolvedValue({ data: null, error: { message: 'private SQL' } });
    await expect(store.claim()).rejects.toThrow('Availability invitation claim failed');
    await expect(store.current(claim)).rejects.toThrow('Availability invitation check failed');
    await expect(store.finish(claim, 'retry')).rejects.toThrow('Availability invitation completion failed');
  });
});
