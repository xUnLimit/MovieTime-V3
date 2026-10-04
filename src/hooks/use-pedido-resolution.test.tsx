import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePedidoResolution } from './use-pedido-resolution';

const state = vi.hoisted(() => ({ quote: vi.fn(), accept: vi.fn(), assign: vi.fn(), refund: vi.fn() }));
vi.mock('@/application/use-cases/pedido-resolution-use-cases', () => ({ getPedidoResolutionQuoteUseCase: state.quote, acceptPedidoResolutionQuoteUseCase: state.accept, assignPedidoItemsUseCase: state.assign, refundPedidoUnallocatedUseCase: state.refund }));
beforeEach(() => { vi.clearAllMocks(); state.quote.mockResolvedValue({ total: 12, difference: 0, items: [] }); state.accept.mockResolvedValue('order-1'); state.assign.mockResolvedValue('order-1'); state.refund.mockResolvedValue('order-1'); });
function setup() { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); return { client, Wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }; }
describe('revisión de pedido', () => {
  it('consulta el precio solo al abrirlo y refresca saldo y cotización después de cada acción', async () => {
    const { client, Wrapper } = setup(); const invalidate = vi.spyOn(client, 'invalidateQueries');
    const hook = renderHook(({ show }) => usePedidoResolution('order-1', show), { initialProps: { show: false }, wrapper: Wrapper });
    expect(state.quote).not.toHaveBeenCalled(); hook.rerender({ show: true }); await waitFor(() => expect(hook.result.current.quote.isSuccess).toBe(true));
    await act(async () => { await hook.result.current.accept.mutateAsync(12); await hook.result.current.assign.mutateAsync({ itemIds: ['i1'], amount: 6 }); await hook.result.current.refund.mutateAsync({ reference: 'BANK-01', amount: 6 }); });
    expect(state.accept).toHaveBeenCalledWith('order-1', 12, expect.any(String)); expect(state.assign).toHaveBeenCalledWith('order-1', ['i1'], 6, expect.any(String)); expect(state.refund).toHaveBeenCalledWith('order-1', 'BANK-01', 6, expect.any(String));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pedidos'] }); expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pedido-resolution', 'order-1'] });
    hook.unmount(); client.clear();
  });
  it('conserva la clave tras una respuesta perdida y la renueva al completar', async () => {
    const { client, Wrapper } = setup(); const hook = renderHook(() => usePedidoResolution('order-1', false), { wrapper: Wrapper });
    state.refund.mockRejectedValueOnce(new Error('network lost'));
    const input = { reference: 'BANK-02', amount: 8 };
    await act(async () => { await expect(hook.result.current.refund.mutateAsync(input)).rejects.toThrow('network lost'); });
    await act(async () => { await hook.result.current.refund.mutateAsync(input); await hook.result.current.refund.mutateAsync(input); });
    expect(state.refund.mock.calls[0][3]).toBe(state.refund.mock.calls[1][3]); expect(state.refund.mock.calls[2][3]).not.toBe(state.refund.mock.calls[1][3]);
    hook.unmount(); client.clear();
  });
});
