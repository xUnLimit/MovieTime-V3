import { beforeEach, expect, it, vi } from 'vitest';
import { createPedidoPanelRpc, listPedidosRpc, mutatePedidoRpc, reconcilePedidoRpc, resolvePedidoExcessRpc } from './orders-rpc-adapter';
import { callRpc } from './rpc-client';

vi.mock('./rpc-client', () => ({ callRpc: vi.fn() }));
vi.mock('./idempotent-rpc', () => ({ executeIdempotentRpc: async (_name: string, payload: object, send: (input: object) => Promise<{ data: string }>) => (await send(payload)).data }));
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.clearAllMocks(); vi.mocked(callRpc).mockResolvedValue({ data: id, error: null }); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); });
it('sends one typed idempotent RPC per panel intent or order command', async () => {
  await createPedidoPanelRpc([], id); await listPedidosRpc(); await mutatePedidoRpc(id, 'retry', id);
  await reconcilePedidoRpc(id, 'CODE123', id);
  expect(callRpc).toHaveBeenNthCalledWith(1, 'mt_panel_checkout', { p_groups: [], p_idempotency_key: id });
  expect(callRpc).toHaveBeenLastCalledWith('mt_reconcile_order', { p_order_id: id, p_code: 'CODE123', p_wa_id: null, p_idempotency_key: id });
  await resolvePedidoExcessRpc(id, 'credito', 'REF-123', 3, id);
  expect(callRpc).toHaveBeenLastCalledWith('mt_resolve_excess', { p_order_id: id, p_action: 'credito', p_reference: 'REF-123', p_expected_amount: 3, p_idempotency_key: id });
});
it('rejects offline financial commands and malformed ids before making network writes', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  expect(() => createPedidoPanelRpc([], id)).toThrow('internet');
  expect(() => mutatePedidoRpc(id, 'cancel', id)).toThrow('internet');
  expect(() => reconcilePedidoRpc(id, 'CODE123', id)).toThrow('internet');
  expect(() => resolvePedidoExcessRpc(id, 'credito', 'REF-123', 3, id)).toThrow('internet');
  expect(callRpc).not.toHaveBeenCalled();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  expect(() => mutatePedidoRpc('bad', 'retry', id)).toThrow('UUID');
});
it('does not publish database diagnostics in an operator-facing read error', async () => {
  vi.mocked(callRpc).mockResolvedValue({ data: null, error: { message: 'SQL detail' } });
  await expect(listPedidosRpc()).rejects.toThrow('No se pudieron cargar los pedidos.');
});
