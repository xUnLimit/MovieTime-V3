import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), service: vi.fn(), user: vi.fn() }));
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: mocks.service, createUserRequestClient: mocks.user }));
import { createOrderDeliveryStore, resolveAccessSale } from './order-delivery-store';
const id = '11111111-1111-4111-8111-111111111111';
const claim = { id, itemId: id, orderId: id, saleId: id, waId: '50760000001', token: id, fence: 3, attempts: 1 };
const access = { saleId: id, serviceId: id, waId: claim.waId, name: 'Netflix', email: 'fixture@example.test',
  profile: 'Perfil', mode: 'code', provider: 'netflix', password: null, pin: null, expiresAt: '2026-12-01' };
beforeEach(() => { vi.clearAllMocks(); mocks.service.mockReturnValue({ rpc: mocks.rpc }); mocks.user.mockReturnValue({ rpc: mocks.rpc }); });
describe('delivery authorized adapter', () => {
  it('injects user identity for manual requests and service identity for recovery', async () => {
    const store = createOrderDeliveryStore('Bearer admin'); expect(mocks.user).toHaveBeenCalledWith('Bearer admin');
    mocks.rpc.mockResolvedValue({ data: claim, error: null }); expect(await store.claim(id)).toEqual(claim);
    expect(mocks.rpc).toHaveBeenLastCalledWith('mt_claim_order_delivery', { p_order_id: id });
    mocks.rpc.mockResolvedValue({ data: null, error: null }); expect(await store.claim()).toBeNull();
    expect(mocks.rpc).toHaveBeenLastCalledWith('mt_claim_order_delivery', { p_order_id: null });
    createOrderDeliveryStore(); expect(mocks.service).toHaveBeenCalled();
  });
  it('passes the current fence and token and validates transient access', async () => {
    const store = createOrderDeliveryStore(); mocks.rpc.mockResolvedValue({ data: access, error: null });
    expect(await store.access(claim)).toEqual(access);
    expect(mocks.rpc).toHaveBeenCalledWith('mt_order_delivery_access', { p_id: id, p_token: id, p_fence: 3 });
    mocks.rpc.mockResolvedValue({ data: null, error: null }); expect(await store.access(claim)).toBeNull();
    mocks.rpc.mockResolvedValue({ data: { ...access, mode: 'unknown' }, error: null });
    await expect(store.access(claim)).rejects.toThrow();
  });
  it('requires accepted completion from SQL and preserves fenced rejection', async () => {
    const store = createOrderDeliveryStore(); mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect(await store.finish(claim, 'accepted', id)).toBe(true);
    expect(mocks.rpc).toHaveBeenLastCalledWith('mt_finish_order_delivery', { p_id: id, p_token: id,
      p_fence: 3, p_result: 'accepted', p_outbound_id: id });
    mocks.rpc.mockResolvedValue({ data: false, error: null }); expect(await store.finish(claim, 'review')).toBe(false);
    expect(mocks.rpc).toHaveBeenLastCalledWith('mt_finish_order_delivery', expect.objectContaining({ p_outbound_id: null }));
    expect(await store.retry(id)).toBe(false);
    mocks.rpc.mockResolvedValue({ data: true, error: null }); expect(await store.retry(id)).toBe(true);
    await expect(store.retry('bad')).rejects.toThrow();
  });
  it('fails closed on SQL failures and malformed claim payloads', async () => {
    const store = createOrderDeliveryStore(); mocks.rpc.mockResolvedValue({ data: null, error: { message: 'private sql' } });
    await expect(store.claim()).rejects.toThrow('Delivery claim failed');
    await expect(store.access(claim)).rejects.toThrow('Delivery authorization failed');
    await expect(store.finish(claim, 'retry')).rejects.toThrow('Delivery completion failed');
    await expect(store.retry(id)).rejects.toThrow('Delivery retry failed');
    mocks.rpc.mockResolvedValue({ data: { ...claim, waId: 'other' }, error: null });
    await expect(store.claim()).rejects.toThrow();
  });
  it('resolves access only through contact and sale validated on the server', async () => {
    mocks.rpc.mockResolvedValue({ data: id, error: null });
    expect(await resolveAccessSale(claim.waId, id)).toBe(id);
    expect(mocks.rpc).toHaveBeenLastCalledWith('mt_resolve_access_sale', { p_wa_id: claim.waId, p_sale_id: id });
    mocks.rpc.mockResolvedValue({ data: null, error: null }); expect(await resolveAccessSale(claim.waId, id)).toBeNull();
    await expect(resolveAccessSale('bad', id)).rejects.toThrow();
    await expect(resolveAccessSale(claim.waId, 'bad')).rejects.toThrow();
    mocks.rpc.mockResolvedValue({ data: 'bad', error: null }); await expect(resolveAccessSale(claim.waId, id)).rejects.toThrow();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'private' } });
    await expect(resolveAccessSale(claim.waId, id)).rejects.toThrow('Access sale authorization failed');
  });
});
