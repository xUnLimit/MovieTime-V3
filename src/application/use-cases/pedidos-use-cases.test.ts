import { beforeEach, describe, expect, it, vi } from 'vitest';
const { create, confirm, cancel } = vi.hoisted(() => ({ create: vi.fn(), confirm: vi.fn(), cancel: vi.fn() }));
vi.mock('@/platform/supabase/pedidos-repository', () => ({ crearPedido: create, confirmarPedido: confirm, cancelarPedido: cancel }));
import { cancelarPedidoUseCase, confirmarPedidoUseCase, crearPedidoUseCase } from './pedidos-use-cases';
import type { CrearPedidoInput } from '@/platform/supabase/pedidos-schemas';

const id = '10000000-0000-4000-8000-000000000001';
const draft: CrearPedidoInput = {
  p_tercero_id: null, p_contact_id: 'lead', p_canal: 'whatsapp', p_moneda: 'USD',
  p_exchange_rate: 1, p_idempotency_key: id, p_expira_at: '2099-01-01T00:00:00Z',
  p_items: [{ tipo: 'renovacion', venta_id: id, ciclo_pago: 'anual' }],
};
describe('pedidos use cases', () => {
  beforeEach(() => { vi.clearAllMocks(); create.mockResolvedValue(id); confirm.mockResolvedValue(id); cancel.mockResolvedValue(id); });
  it('validates and delegates a draft without global UI state', async () => {
    await expect(crearPedidoUseCase(draft)).resolves.toBe(id);
    expect(create).toHaveBeenCalledWith({ ...draft, p_items: [{ ...draft.p_items[0], descuento: 0 }] });
  });
  it('rejects an expired draft', async () => {
    await expect(crearPedidoUseCase({ ...draft, p_expira_at: '2000-01-01T00:00:00Z' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects duplicate renewals', async () => {
    await expect(crearPedidoUseCase({ ...draft, p_items: [...draft.p_items, ...draft.p_items] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(create).not.toHaveBeenCalled();
  });
  it('confirms partial payments and cancellation through the repository', async () => {
    const intent = { p_pedido_id: id, p_idempotency_key: id };
    await expect(confirmarPedidoUseCase({ ...intent, p_source: 'manual', p_monto: 1 })).resolves.toBe(id);
    expect(confirm).toHaveBeenCalledWith({ ...intent, p_source: 'manual', p_monto: 1, p_yappy_payment_id: null });
    await expect(cancelarPedidoUseCase(intent)).resolves.toBe(id);
    expect(cancel).toHaveBeenCalledWith(intent);
  });
  it('rejects boundary input and propagates controlled repository failures', async () => {
    await expect(cancelarPedidoUseCase({ p_pedido_id: 'bad', p_idempotency_key: id })).rejects.toThrow();
    await expect(confirmarPedidoUseCase({ p_pedido_id: id, p_idempotency_key: id, p_source: 'manual', p_monto: -1 })).rejects.toThrow();
    create.mockRejectedValueOnce(new Error('controlled'));
    await expect(crearPedidoUseCase(draft)).rejects.toThrow('controlled');
    expect(confirm).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
  });
});
