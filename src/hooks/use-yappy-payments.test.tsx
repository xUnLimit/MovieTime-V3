import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useYappyActions, useYappyCandidateVentas, useYappyConnections, useYappyPayments, useYappyVentaSearch } from './use-yappy-payments';

const state = vi.hoisted(() => ({ admin: true, payments: vi.fn(), connections: vi.fn(), ventas: vi.fn(), search: vi.fn(), sync: vi.fn(), resolve: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (value: { user: { role: string } }) => unknown) => selector({ user: { role: state.admin ? 'admin' : 'vendedor' } }) }));
vi.mock('@/application/use-cases/yappy-use-cases', () => ({
  fetchYappyPayments: state.payments, fetchYappyConnections: state.connections, fetchYappyCandidateVentas: state.ventas,
  searchYappyVentas: state.search, syncYappyNowUseCase: state.sync, resolveYappyUseCase: state.resolve, dismissYappyUseCase: state.dismiss,
}));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, Wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
const ventaA = '123e4567-e89b-12d3-a456-426614174004';
const ventaB = '123e4567-e89b-12d3-a456-426614174005';

beforeEach(() => {
  vi.clearAllMocks();
  state.admin = true;
  state.payments.mockResolvedValue([]);
  state.connections.mockResolvedValue([]);
  state.ventas.mockResolvedValue([]);
  state.search.mockResolvedValue([]);
  state.sync.mockResolvedValue({ errorCode: null });
  state.resolve.mockResolvedValue(undefined);
  state.dismiss.mockResolvedValue(undefined);
});

describe('Yappy hooks', () => {
  it('loads the queue, the mailbox and the candidate sales for an administrator', async () => {
    const { client, Wrapper } = wrapper();
    const payments = renderHook(() => useYappyPayments(), { wrapper: Wrapper });
    const connections = renderHook(() => useYappyConnections(), { wrapper: Wrapper });
    const ventas = renderHook(() => useYappyCandidateVentas([ventaB, ventaA, ventaB]), { wrapper: Wrapper });
    await waitFor(() => expect(payments.result.current.isSuccess && connections.result.current.isSuccess && ventas.result.current.isSuccess).toBe(true));
    expect(state.ventas).toHaveBeenCalledWith([ventaA, ventaB]);
    client.clear();
  });

  it('does not query anything Yappy for a non administrator', () => {
    state.admin = false;
    const { client, Wrapper } = wrapper();
    renderHook(() => useYappyPayments(), { wrapper: Wrapper });
    renderHook(() => useYappyConnections(), { wrapper: Wrapper });
    renderHook(() => useYappyCandidateVentas(), { wrapper: Wrapper });
    renderHook(() => useYappyVentaSearch('Netflix', true), { wrapper: Wrapper });
    expect(state.payments).not.toHaveBeenCalled();
    expect(state.connections).not.toHaveBeenCalled();
    expect(state.ventas).not.toHaveBeenCalled();
    expect(state.search).not.toHaveBeenCalled();
    client.clear();
  });

  it('searches sales only when asked and with at least two characters', async () => {
    const { client, Wrapper } = wrapper();
    const hook = renderHook(({ term, enabled }) => useYappyVentaSearch(term, enabled), { initialProps: { term: 'Netflix', enabled: false }, wrapper: Wrapper });
    hook.rerender({ term: 'N', enabled: true });
    expect(state.search).not.toHaveBeenCalled();
    hook.rerender({ term: 'Netflix', enabled: true });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(state.search).toHaveBeenCalledWith('Netflix');
    client.clear();
  });

  it('refreshes the queue after each command and the mailbox after a sync', async () => {
    const { client, Wrapper } = wrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const actions = renderHook(() => useYappyActions(), { wrapper: Wrapper });
    await act(async () => {
      await actions.result.current.sync.mutateAsync();
      await actions.result.current.resolve.mutateAsync({ paymentId: 'p1', ventaId: ventaA });
      await actions.result.current.dismiss.mutateAsync({ paymentId: 'p2', note: 'Aviso repetido' });
    });
    expect(state.resolve).toHaveBeenCalledWith('p1', ventaA);
    expect(state.dismiss).toHaveBeenCalledWith('p2', 'Aviso repetido');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['yappy', 'connections'] });
    expect(invalidate.mock.calls.filter(([filters]) => filters?.queryKey?.[1] === 'payments')).toHaveLength(3);
    client.clear();
  });
});
