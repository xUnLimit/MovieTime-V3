import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ admin: true, fetch: vi.fn() }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (value: { user: { role: string } }) => unknown) => selector({ user: { role: state.admin ? 'admin' : 'vendedor' } }) }));
vi.mock('@/application/use-cases/commerce-copy-use-cases', () => ({ fetchCommerceCopyUseCase: state.fetch }));
import { useCommerceCopy } from './use-commerce-copy';

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; };
}

beforeEach(() => { vi.clearAllMocks(); state.admin = true; state.fetch.mockResolvedValue({ overrides: { btnPay: 'Pagar ya' }, updatedAt: {} }); });

describe('useCommerceCopy', () => {
  it('lee los textos guardados fuera del recorrido para un administrador', async () => {
    const { result } = renderHook(() => useCommerceCopy(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.overrides).toEqual({ btnPay: 'Pagar ya' }));
  });
  it('no consulta nada para otros roles', () => {
    state.admin = false;
    const { result } = renderHook(() => useCommerceCopy(), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(state.fetch).not.toHaveBeenCalled();
  });
});
