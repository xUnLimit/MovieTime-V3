import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePedidoUseCase, markPedidoDeliveredUseCase, registerPedidoPaymentUseCase } from './pedidos-use-cases';
import { deletePedidoRpc, markPedidoDeliveredRpc, registerPedidoPaymentRpc } from '@/platform/supabase/orders-rpc-adapter';
import { storeEventBus } from '@/platform/events/store-event-bus';

vi.mock('@/platform/supabase/orders-rpc-adapter', () => ({ deletePedidoRpc: vi.fn(), markPedidoDeliveredRpc: vi.fn(), registerPedidoPaymentRpc: vi.fn() }));
vi.mock('@/platform/cache/store-query-invalidation', () => ({ invalidateStoreQueries: vi.fn(async () => undefined) }));
const id = '11111111-1111-4111-8111-111111111111';
const key = '22222222-2222-4222-8222-222222222222';
beforeEach(() => { vi.clearAllMocks(); storeEventBus.clear(); });

describe('acciones manuales de pedidos', () => {
  it('elimina y entrega con ids validados y avisan solo tras confirmar', async () => {
    vi.mocked(deletePedidoRpc).mockResolvedValue(id);
    vi.mocked(markPedidoDeliveredRpc).mockResolvedValue(id);
    const received = vi.fn(); storeEventBus.on('DASHBOARD_INVALIDATED', received);
    expect(await deletePedidoUseCase(id, key)).toBe(id);
    expect(await markPedidoDeliveredUseCase(id, key)).toBe(id);
    expect(deletePedidoRpc).toHaveBeenCalledWith(id, key);
    expect(received).toHaveBeenCalledTimes(2);
    await expect(deletePedidoUseCase('x', key)).rejects.toThrow();
    await expect(markPedidoDeliveredUseCase(id, 'x')).rejects.toThrow();
  });
  it('no avisa si el servidor rechaza la operación', async () => {
    vi.mocked(deletePedidoRpc).mockRejectedValue(new Error('pedido_has_history'));
    const received = vi.fn(); storeEventBus.on('DASHBOARD_INVALIDATED', received);
    await expect(deletePedidoUseCase(id, key)).rejects.toThrow('pedido_has_history');
    expect(received).not.toHaveBeenCalled();
  });
  it('registra un pago manual válido y rechaza montos o referencias inválidos antes de enviar', async () => {
    vi.mocked(registerPedidoPaymentRpc).mockResolvedValue(id);
    expect(await registerPedidoPaymentUseCase(id, 5.5, ' Efectivo 5-oct ', key)).toBe(id);
    expect(registerPedidoPaymentRpc).toHaveBeenCalledWith(id, 5.5, 'Efectivo 5-oct', key);
    for (const [amount, reference] of [[0, 'Efectivo'], [-1, 'Efectivo'], [5.123, 'Efectivo'], [2_000_000, 'Efectivo'], [5, '<b>'], [5, 'ab']] as const) {
      await expect(registerPedidoPaymentUseCase(id, amount, reference, key)).rejects.toThrow();
    }
    expect(registerPedidoPaymentRpc).toHaveBeenCalledTimes(1);
  });
});
