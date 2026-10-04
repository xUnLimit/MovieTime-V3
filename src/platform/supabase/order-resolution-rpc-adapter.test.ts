import { beforeEach, expect, it, vi } from 'vitest';
import { getPedidoResolutionQuoteRpc, resolvePedidoRpc } from './order-resolution-rpc-adapter';
import { callRpc } from './rpc-client';
vi.mock('./rpc-client', () => ({ callRpc: vi.fn() }));
vi.mock('./idempotent-rpc', () => ({ executeIdempotentRpc: async (_name: string, payload: object, send: (input: object) => Promise<{ data: string }>) => (await send(payload)).data }));
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.clearAllMocks(); vi.mocked(callRpc).mockResolvedValue({ data: id, error: null }); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); });
it('uses the typed atomic resolution RPC with the original intent', async () => {
  await resolvePedidoRpc(id, 'refund', 10, 'BANK-123', null, id);
  expect(callRpc).toHaveBeenCalledWith('mt_resolve_order', { p_order_id: id, p_action: 'refund', p_expected_amount: 10, p_reference: 'BANK-123', p_items: null, p_idempotency_key: id });
  await getPedidoResolutionQuoteRpc(id);
  expect(callRpc).toHaveBeenLastCalledWith('mt_order_resolution_quote', { p_order_id: id });
});
it('blocks offline writes and invalid ids before networking', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  expect(() => resolvePedidoRpc(id, 'assign_items', 10, null, [id], id)).toThrow('internet');
  await expect(getPedidoResolutionQuoteRpc('bad')).rejects.toThrow('UUID');
  expect(callRpc).not.toHaveBeenCalled();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  expect(() => resolvePedidoRpc('bad', 'refund', 10, 'BANK-123', null, id)).toThrow('UUID');
});
it('returns a public quote error without leaking SQL diagnostics', async () => {
  vi.mocked(callRpc).mockResolvedValue({ data: null, error: { message: 'SQL private' } });
  await expect(getPedidoResolutionQuoteRpc(id)).rejects.toThrow('No se pudieron revisar las condiciones del pedido.');
});
