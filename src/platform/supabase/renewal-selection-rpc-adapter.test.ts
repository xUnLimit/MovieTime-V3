import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./client', () => ({ supabase: { rpc,
  auth: { getSession: async () => ({ data: { session: { user: { id: 'renewal-test' } } }, error: null }) },
} }));
import { createRenewalSelectionOrderRpc, type RenewalOrderInput } from './renewal-selection-rpc-adapter';
const id = '10000000-0000-4000-8000-000000000001';
const input: RenewalOrderInput = { p_tercero_id: id, p_contact_id: null, p_canal: 'whatsapp', p_moneda: 'USD',
  p_exchange_rate: 1, p_expira_at: '2099-01-01T00:00:00Z', p_idempotency_key: id,
  p_items: [{ tipo: 'renovacion', venta_id: id, ciclo_pago: 'mensual', descuento: 0 }],
  p_notice_id: id, p_wa_id: '50760000000', p_expected: [{ venta_id: id, period_id: id, precio: 5 }] };
describe('partial renewal RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    rpc.mockResolvedValue({ data: id, error: null });
  });
  it('uses the typed, guarded RPC with explicit intent', async () => {
    expect(await createRenewalSelectionOrderRpc(input)).toBe(id);
    expect(rpc).toHaveBeenCalledWith('crear_pedido_renovacion', input);
  });
  it('retains the same key after a transport failure and hides SQL details', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'SQL internal failure' } });
    await expect(createRenewalSelectionOrderRpc(input)).rejects.toMatchObject({ code: 'RENEWAL_ORDER_FAILED' });
    await createRenewalSelectionOrderRpc(input);
    expect(rpc.mock.calls[0][1].p_idempotency_key).toBe(rpc.mock.calls[1][1].p_idempotency_key);
  });
  it.each([null, {}, 123, ''])('rejects invalid RPC IDs %j', async data => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(createRenewalSelectionOrderRpc(input)).rejects.toMatchObject({ code: 'RENEWAL_ORDER_FAILED' });
  });
  it('validates snapshots and rejects non-renewal orders', async () => {
    await expect(createRenewalSelectionOrderRpc({ ...input, p_notice_id: 'invalid' })).rejects.toThrow();
    await expect(createRenewalSelectionOrderRpc({ ...input, p_expected: [] })).rejects.toThrow();
    await expect(createRenewalSelectionOrderRpc({ ...input, p_items: [{ tipo: 'nueva', plan_id: id, servicio_id: id, ciclo_pago: 'mensual' }] })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('blocks offline mutation', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(createRenewalSelectionOrderRpc(input)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
