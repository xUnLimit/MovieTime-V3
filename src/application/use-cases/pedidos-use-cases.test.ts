import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePedidoExcessUseCase, cancelPedidoUseCase, createPedidoPanelUseCase, listPedidosUseCase, reconcilePedidoUseCase, retryPedidoUseCase } from './pedidos-use-cases';
import { resolvePedidoExcessRpc, createPedidoPanelRpc, listPedidosRpc, mutatePedidoRpc, reconcilePedidoRpc } from '@/platform/supabase/orders-rpc-adapter';
import { storeEventBus } from '@/platform/events/store-event-bus';
import type { PanelCart } from '@/modules/orders/contracts';

vi.mock('@/platform/supabase/orders-rpc-adapter', () => ({
  createPedidoPanelRpc: vi.fn(), listPedidosRpc: vi.fn(), mutatePedidoRpc: vi.fn(), reconcilePedidoRpc: vi.fn(), resolvePedidoExcessRpc: vi.fn(),
}));
const id = '11111111-1111-4111-8111-111111111111';
const cart: PanelCart = [{ clienteId: id, moneda: 'USD', exchangeRate: 1, items: [{
  planId: id, servicioId: id, perfilNumero: null, descuento: 0, precio: 10, cicloPago: 'mensual',
  fechaInicio: '2026-10-01', fechaFin: '2026-11-01', estado: 'activo', perfilNombre: '', codigo: '', notas: '',
  metodoPagoId: null, metodoPagoNombre: 'Yappy',
}] }];
const order = { id, terceroId: id, contactId: null, moneda: 'USD', total: 10, estado: 'pagado',
  paymentState: 'cubierto', deliveryState: 'pendiente', receivedAmount: 10, missingAmount: 0, excessAmount: 0,
  expiraAt: '2026-11-01', items: [] };
beforeEach(() => { vi.clearAllMocks(); storeEventBus.clear(); });

describe('pedido commands', () => {
  it('sends one validated cart and invalidates financial readers only after commit', async () => {
    vi.mocked(createPedidoPanelRpc).mockResolvedValue(id);
    const received = vi.fn();
    storeEventBus.on('DASHBOARD_INVALIDATED', received);
    expect(await createPedidoPanelUseCase(cart, id)).toBe(id);
    expect(createPedidoPanelRpc).toHaveBeenCalledWith(cart, id);
    expect(received).toHaveBeenCalledOnce();
  });
  it('does not emit a committed mutation when the transaction fails', async () => {
    vi.mocked(createPedidoPanelRpc).mockRejectedValue(new Error('stock'));
    const received = vi.fn(); storeEventBus.on('DASHBOARD_INVALIDATED', received);
    await expect(createPedidoPanelUseCase(cart, id)).rejects.toThrow('stock');
    expect(received).not.toHaveBeenCalled();
  });
  it('rejects a mixed customer cart, repeated currency or inverted period before persistence', async () => {
    await expect(createPedidoPanelUseCase([...cart, ...cart], id)).rejects.toThrow();
    await expect(createPedidoPanelUseCase([cart[0], { ...cart[0], moneda: 'EUR', clienteId: '22222222-2222-4222-8222-222222222222' }], id)).rejects.toThrow();
    await expect(createPedidoPanelUseCase([{ ...cart[0], items: [{ ...cart[0].items[0], fechaFin: '2026-09-01' }] }], id)).rejects.toThrow();
    expect(createPedidoPanelRpc).not.toHaveBeenCalled();
  });
  it('validates returned financial state and rejects malformed backend data', async () => {
    vi.mocked(listPedidosRpc).mockResolvedValue([order]);
    expect(await listPedidosUseCase()).toEqual([order]);
    vi.mocked(listPedidosRpc).mockResolvedValue([{ ...order, receivedAmount: -1 }]);
    await expect(listPedidosUseCase()).rejects.toThrow();
  });
  it('retains the retry intention and validates ids and receipt codes before RPC', async () => {
    vi.mocked(mutatePedidoRpc).mockResolvedValue(id);
    vi.mocked(reconcilePedidoRpc).mockResolvedValue(id);
    await retryPedidoUseCase(id, id); await cancelPedidoUseCase(id, id); await reconcilePedidoUseCase(id, ' ABC123 ', id);
    expect(mutatePedidoRpc).toHaveBeenNthCalledWith(1, id, 'retry', id);
    expect(mutatePedidoRpc).toHaveBeenNthCalledWith(2, id, 'cancel', id);
    expect(reconcilePedidoRpc).toHaveBeenCalledWith(id, 'ABC123', id);
    expect(() => cancelPedidoUseCase('bad', id)).toThrow();
    expect(() => reconcilePedidoUseCase(id, '<script>', id)).toThrow();
  });
  it('resolves only a positive pending excess with a traceable financial reference', async () => {
    vi.mocked(resolvePedidoExcessRpc).mockResolvedValue(id);
    expect(await resolvePedidoExcessUseCase(id, 'credito', ' BANK-123 ', 3, id)).toBe(id);
    expect(resolvePedidoExcessRpc).toHaveBeenCalledWith(id, 'credito', 'BANK-123', 3, id);
    expect(() => resolvePedidoExcessUseCase(id, 'credito', 'BANK-123', -1, id)).toThrow();
    expect(() => resolvePedidoExcessUseCase(id, 'credito', '<script>', 3, id)).toThrow();
  });
});
