import { beforeEach, expect, it, vi } from 'vitest';
import { deletePedidoRpc, markPedidoDeliveredRpc, registerPedidoPaymentRpc } from './orders-rpc-adapter';
import { callRpc } from './rpc-client';

vi.mock('./rpc-client', () => ({ callRpc: vi.fn() }));
vi.mock('./idempotent-rpc', () => ({ executeIdempotentRpc: async (_name: string, payload: object, send: (input: object) => Promise<{ data: string }>) => (await send(payload)).data }));
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.clearAllMocks(); vi.mocked(callRpc).mockResolvedValue({ data: id, error: null }); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); });

it('envía una RPC tipada e idempotente por cada acción manual', async () => {
  await deletePedidoRpc(id, id);
  expect(callRpc).toHaveBeenLastCalledWith('mt_delete_order', { p_order_id: id, p_idempotency_key: id });
  await registerPedidoPaymentRpc(id, 5.5, 'Efectivo', id);
  expect(callRpc).toHaveBeenLastCalledWith('mt_register_order_payment', { p_order_id: id, p_amount: 5.5, p_reference: 'Efectivo', p_idempotency_key: id });
  await markPedidoDeliveredRpc(id, id);
  expect(callRpc).toHaveBeenLastCalledWith('mt_mark_order_delivered', { p_order_id: id, p_idempotency_key: id });
});
it('rechaza sin internet o con ids mal formados antes de escribir', () => {
  expect(() => deletePedidoRpc('bad', id)).toThrow('UUID');
  expect(() => registerPedidoPaymentRpc(id, 1, 'Efectivo', 'bad')).toThrow('UUID');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  expect(() => markPedidoDeliveredRpc(id, id)).toThrow('internet');
  expect(callRpc).not.toHaveBeenCalled();
});
