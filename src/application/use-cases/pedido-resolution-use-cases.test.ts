import { beforeEach, expect, it, vi } from 'vitest';
import { acceptPedidoResolutionQuoteUseCase, assignPedidoItemsUseCase, getPedidoResolutionQuoteUseCase, refundPedidoUnallocatedUseCase } from './pedido-resolution-use-cases';
import { getPedidoResolutionQuoteRpc, resolvePedidoRpc } from '@/platform/supabase/order-resolution-rpc-adapter';
import { storeEventBus } from '@/platform/events/store-event-bus';

vi.mock('@/platform/supabase/order-resolution-rpc-adapter', () => ({ getPedidoResolutionQuoteRpc: vi.fn(), resolvePedidoRpc: vi.fn() }));
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.clearAllMocks(); storeEventBus.clear(); vi.mocked(resolvePedidoRpc).mockResolvedValue(id); });
it('validates server quotes before showing changed commercial terms', async () => {
  vi.mocked(getPedidoResolutionQuoteRpc).mockResolvedValue({ total: 12, difference: 2, items: [{ id, oldTotal: 10, newTotal: 12 }] });
  expect(await getPedidoResolutionQuoteUseCase(id)).toMatchObject({ total: 12, difference: 2 });
  vi.mocked(getPedidoResolutionQuoteRpc).mockResolvedValue({ total: -1, items: [] });
  await expect(getPedidoResolutionQuoteUseCase(id)).rejects.toThrow();
  await expect(getPedidoResolutionQuoteUseCase('bad')).rejects.toThrow();
});
it('sends explicit amount, verified external reference and selected item intent', async () => {
  await acceptPedidoResolutionQuoteUseCase(id, 12, id);
  await refundPedidoUnallocatedUseCase(id, ' BANK-123 ', 10, id);
  await assignPedidoItemsUseCase(id, [id], 10, id);
  expect(resolvePedidoRpc).toHaveBeenNthCalledWith(1, id, 'accept_quote', 12, null, null, id);
  expect(resolvePedidoRpc).toHaveBeenNthCalledWith(2, id, 'refund', 10, 'BANK-123', null, id);
  expect(resolvePedidoRpc).toHaveBeenNthCalledWith(3, id, 'assign_items', 10, null, [id], id);
});
it('rejects stale-shaped financial inputs before persistence', () => {
  expect(() => acceptPedidoResolutionQuoteUseCase(id, Infinity, id)).toThrow();
  expect(() => refundPedidoUnallocatedUseCase(id, '<script>', 10, id)).toThrow();
  expect(() => refundPedidoUnallocatedUseCase(id, 'BANK-123', 0, id)).toThrow();
  expect(() => assignPedidoItemsUseCase(id, [id, id], 20, id)).toThrow();
  expect(() => assignPedidoItemsUseCase(id, [], 0, id)).toThrow();
  expect(() => assignPedidoItemsUseCase(id, ['bad'], -1, id)).toThrow();
  expect(resolvePedidoRpc).not.toHaveBeenCalled();
});
it('invalidates financial readers only after the resolution transaction commits', async () => {
  const received = vi.fn(); storeEventBus.on('DASHBOARD_INVALIDATED', received);
  vi.mocked(resolvePedidoRpc).mockRejectedValueOnce(new Error('changed'));
  await expect(refundPedidoUnallocatedUseCase(id, 'BANK-123', 10, id)).rejects.toThrow('changed');
  expect(received).not.toHaveBeenCalled();
  await refundPedidoUnallocatedUseCase(id, 'BANK-123', 10, id);
  expect(received).toHaveBeenCalledOnce();
});
