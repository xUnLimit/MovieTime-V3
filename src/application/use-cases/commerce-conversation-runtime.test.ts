import { beforeEach, describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn()); const cancel = vi.hoisted(() => vi.fn());
const settings = vi.hoisted(() => vi.fn());
vi.mock('@/modules/automation-control/store', () => ({ createAutomationControlStore: () => ({ settings }) }));
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: () => ({ rpc }) }));
vi.mock('./pedidos-server-use-cases', () => ({
  listCatalogoServerUseCase: vi.fn(), listServiciosServerUseCase: vi.fn(), createCompraServerUseCase: vi.fn(),
  createRenovacionServerUseCase: vi.fn(), getPedidoServerUseCase: vi.fn(), reconcilePedidoServerUseCase: vi.fn(), cancelPedidoServerUseCase: cancel,
}));
import { createCommerceConversationDeps } from './commerce-conversation-runtime';
const id = '123e4567-e89b-42d3-a456-426614174000';
beforeEach(() => { vi.resetAllMocks(); delete process.env.YAPPY_PAYMENT_INSTRUCTIONS; });
describe('commerce server composition', () => {
  it('injects the new-purchase capability separately from paid-order processing', async () => {
    settings.mockResolvedValue({ purchasesEnabled: false });
    expect(await createCommerceConversationDeps().purchasesEnabled?.()).toBe(false);
    settings.mockResolvedValue({ purchasesEnabled: true });
    expect(await createCommerceConversationDeps().purchasesEnabled?.()).toBe(true);
  });
  it('injects verified payment instructions and delegates cancellation without inventing a recipient', async () => {
    expect(createCommerceConversationDeps().paymentInstructions).toBeNull();
    process.env.YAPPY_PAYMENT_INSTRUCTIONS = 'Paga al beneficiario comercial verificado.';
    const deps = createCommerceConversationDeps(); expect(deps.paymentInstructions).toContain('beneficiario');
    await deps.cancelOrder('50760000000', id, id); expect(cancel).toHaveBeenCalledWith('50760000000', id, id);
    delete process.env.YAPPY_PAYMENT_INSTRUCTIONS;
  });
  it('validates demand ownership and identifiers at the server boundary', async () => {
    const deps = createCommerceConversationDeps(); rpc.mockResolvedValue({ data: id, error: null });
    await deps.interest('50760000000', id, id, true);
    expect(rpc).toHaveBeenCalledWith('mt_register_interest', { p_contact: '50760000000', p_category_id: id, p_plan_id: id, p_consent: true });
    await expect(deps.interest('foreign', id, id, true)).rejects.toThrow();
    await expect(deps.interest('50760000000', 'bad', id, true)).rejects.toThrow();
    rpc.mockResolvedValue({ data: null, error: { message: 'internal' } });
    await expect(deps.interest('50760000000', id, id, false)).rejects.toThrow('Interest registration failed');
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(deps.interest('50760000000', id, id, false)).rejects.toThrow();
  });
});
