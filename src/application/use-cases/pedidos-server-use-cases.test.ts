import { beforeEach, expect, it, vi } from 'vitest';
import { cancelPedidoServerUseCase, retryComprobantesServerUseCase, createCompraServerUseCase, createRenovacionServerUseCase, getPedidoServerUseCase, listCatalogoServerUseCase, listServiciosServerUseCase, reconcilePedidoServerUseCase, matchPedidoPaymentServerUseCase } from './pedidos-server-use-cases';
import * as rpc from '@/platform/server/orders-server-rpc-adapter';

vi.mock('@/platform/server/orders-server-rpc-adapter', () => ({
  catalogoServerRpc: vi.fn(), serviciosServerRpc: vi.fn(), createCommerceOrderRpc: vi.fn(), getCommerceOrderRpc: vi.fn(), reconcileCommerceOrderRpc: vi.fn(), matchCommerceOrderPaymentRpc: vi.fn(), cancelCommerceOrderRpc: vi.fn(), retryReceiptsRpc: vi.fn(),
}));
const id = '11111111-1111-4111-8111-111111111111';
const wa = '50760000000';
const order = { id, terceroId: null, contactId: wa, moneda: 'USD', total: 10, estado: 'esperando_pago',
  paymentState: 'parcial', deliveryState: 'pendiente', receivedAmount: 4, missingAmount: 6, excessAmount: 0, expiraAt: '2026-10-04', items: [] };
beforeEach(() => { vi.clearAllMocks(); });

it('binds purchase and renewal to the verified contact, explicit intention and accepted amount', async () => {
  vi.mocked(rpc.createCommerceOrderRpc).mockResolvedValue(id);
  await expect(createCompraServerUseCase(wa, [id], id, 10)).resolves.toBe(id);
  await expect(createRenovacionServerUseCase(wa, [id], id, 15)).resolves.toBe(id);
  expect(rpc.createCommerceOrderRpc).toHaveBeenNthCalledWith(1, wa, [id], 'compra', id, 10);
  expect(rpc.createCommerceOrderRpc).toHaveBeenNthCalledWith(2, wa, [id], 'renovacion', id, 15);
  expect(() => createCompraServerUseCase('arbitrary', [id], id, 10)).toThrow();
  expect(() => createRenovacionServerUseCase(wa, [], id, 10)).toThrow();
  expect(() => createCompraServerUseCase(wa, [id], id, Number.NaN)).toThrow();
});
it('reads only a contact-scoped order and returns partial or surplus balances', async () => {
  vi.mocked(rpc.getCommerceOrderRpc).mockResolvedValue(order);
  await expect(getPedidoServerUseCase(wa, id)).resolves.toEqual(order);
  expect(rpc.getCommerceOrderRpc).toHaveBeenCalledWith(wa, id);
  vi.mocked(rpc.getCommerceOrderRpc).mockResolvedValue({ ...order, paymentState: 'invented' });
  await expect(getPedidoServerUseCase(wa, id)).rejects.toThrow();
  await expect(getPedidoServerUseCase(wa, 'not-id')).rejects.toThrow();
});
it('validates catalog and renewal projection without exposing credentials', async () => {
  const catalog = [{ planId: id, planNombre: 'Mensual', categoriaId: id, categoriaNombre: 'Streaming',
    precio: 10, moneda: 'USD', cicloPago: 'mensual', perfilesLibres: 0, contrasena: 'must-be-stripped' }];
  vi.mocked(rpc.catalogoServerRpc).mockResolvedValue(catalog);
  expect((await listCatalogoServerUseCase())[0]).not.toHaveProperty('contrasena');
  vi.mocked(rpc.serviciosServerRpc).mockResolvedValue([{ ventaId: id, nombre: 'Netflix', precio: 10,
    moneda: 'USD', cicloPago: 'mensual', fechaVencimiento: '2026-10-05' }]);
  expect(await listServiciosServerUseCase(wa)).toHaveLength(1);
  vi.mocked(rpc.serviciosServerRpc).mockResolvedValue([{ ventaId: id, precio: -1 }]);
  await expect(listServiciosServerUseCase(wa)).rejects.toThrow();
});
it('a receipt is evidence to reconcile, and never directly sets delivery or accepts payer phone as ownership', async () => {
  vi.mocked(rpc.reconcileCommerceOrderRpc).mockResolvedValue(id);
  vi.mocked(rpc.getCommerceOrderRpc).mockResolvedValue(order);
  expect(await reconcilePedidoServerUseCase(wa, id, ' CODE123 ', id)).toEqual(order);
  expect(rpc.reconcileCommerceOrderRpc).toHaveBeenCalledWith(wa, id, 'CODE123', id);
  await expect(reconcilePedidoServerUseCase(wa, id, 'bad<script>', id)).rejects.toThrow();
});
it('cancels only a contact-owned pending order and validates the retry worker result', async () => {
  vi.mocked(rpc.cancelCommerceOrderRpc).mockResolvedValue(id);
  expect(await cancelPedidoServerUseCase(wa, id, id)).toBe(id);
  expect(rpc.cancelCommerceOrderRpc).toHaveBeenCalledWith(wa, id, id);
  expect(() => cancelPedidoServerUseCase(wa, 'bad', id)).toThrow();
  vi.mocked(rpc.retryReceiptsRpc).mockResolvedValue(3);
  expect(await retryComprobantesServerUseCase()).toBe(3);
  vi.mocked(rpc.retryReceiptsRpc).mockResolvedValue(-1);
  await expect(retryComprobantesServerUseCase()).rejects.toThrow();
});
it('the last-four match accepts only four digits (or none to escalate) and never takes a client-supplied verdict', async () => {
  vi.mocked(rpc.matchCommerceOrderPaymentRpc).mockResolvedValue(id);
  vi.mocked(rpc.getCommerceOrderRpc).mockResolvedValue(order);
  expect(await matchPedidoPaymentServerUseCase(wa, id, '9238', id)).toEqual(order);
  expect(rpc.matchCommerceOrderPaymentRpc).toHaveBeenCalledWith(wa, id, '9238', id);
  await matchPedidoPaymentServerUseCase(wa, id, null, id);
  expect(rpc.matchCommerceOrderPaymentRpc).toHaveBeenLastCalledWith(wa, id, null, id);
  for (const bad of ['123', '12345', 'abcd', '12 34', 'VAEIZ-93839238']) await expect(matchPedidoPaymentServerUseCase(wa, id, bad, id)).rejects.toThrow();
  await expect(matchPedidoPaymentServerUseCase('foreign', id, '9238', id)).rejects.toThrow();
});
