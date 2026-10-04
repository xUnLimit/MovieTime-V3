import { beforeEach, expect, it, vi } from 'vitest';
import { cancelCommerceOrderRpc, catalogoServerRpc, createCommerceOrderRpc, getCommerceOrderRpc, reconcileCommerceOrderRpc, retryReceiptsRpc, serviciosServerRpc } from './orders-server-rpc-adapter';

const client = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabase-server', () => ({ createServiceRoleClient: () => client }));
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { client.rpc.mockReset().mockResolvedValue({ data: id, error: null }); });

it('uses only service-owned RPCs with the accepted price and contact identity', async () => {
  await catalogoServerRpc(); await serviciosServerRpc('50760000000');
  expect(await createCommerceOrderRpc('50760000000', [id], 'compra', id, 10)).toBe(id);
  expect(client.rpc).toHaveBeenLastCalledWith('mt_create_commerce_order', expect.objectContaining({ p_expected_total: 10, p_wa_id: '50760000000' }));
  await getCommerceOrderRpc('50760000000', id);
  await reconcileCommerceOrderRpc('50760000000', id, 'CODE123', id);
  await cancelCommerceOrderRpc('50760000000', id, id);
  await retryReceiptsRpc();
  expect(client.rpc).toHaveBeenCalledTimes(7);
});
it('returns public errors with private diagnostics as the cause, and rejects malformed financial ids', async () => {
  client.rpc.mockResolvedValue({ data: null, error: { message: 'SQL diagnostic' } });
  await expect(catalogoServerRpc()).rejects.toThrow('No se pudo completar el pedido.');
  await expect(serviciosServerRpc('50760000000')).rejects.toMatchObject({ cause: { message: 'SQL diagnostic' } });
  client.rpc.mockResolvedValue({ data: { id }, error: null });
  await expect(createCommerceOrderRpc('50760000000', [id], 'compra', id, 10)).rejects.toThrow('id valido');
  await expect(getCommerceOrderRpc('50760000000', 'bad')).rejects.toThrow('UUID');
  await expect(reconcileCommerceOrderRpc('50760000000', 'bad', 'CODE123', id)).rejects.toThrow('UUID');
  await expect(cancelCommerceOrderRpc('50760000000', 'bad', id)).rejects.toThrow('UUID');
});
it('reports paused purchases without blocking or disguising paid-order support', async () => {
  client.rpc.mockResolvedValue({ data: null, error: { message: 'pedido_purchases_paused' } });
  await expect(createCommerceOrderRpc('50760000000', [id], 'compra', id, 10)).rejects.toThrow('Seguimos atendiendo los pedidos pagados');
});
