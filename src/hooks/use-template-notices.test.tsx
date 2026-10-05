import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cases = vi.hoisted(() => ({ loadNoticeActivityUseCase: vi.fn(), listRecentNoticesUseCase: vi.fn() }));
vi.mock('@/application/use-cases/automation-use-cases', () => cases);

import { useNoticeActivity, useRecentNotices } from './use-template-notices';

const page = { notices: [], total: 25, page: 1, pageSize: 10 };

beforeEach(() => {
  Object.values(cases).forEach((mock) => mock.mockReset());
  cases.loadNoticeActivityUseCase.mockResolvedValue({ dia_pago: { sent: 4, failed: 0, skipped: 1, lastSentAt: 't' } });
  cases.listRecentNoticesUseCase.mockResolvedValue(page);
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useNoticeActivity', () => {
  it('loads the thirty day counts by tipo', async () => {
    const { result } = renderHook(() => useNoticeActivity(), { wrapper: wrapper() });
    expect(result.current.loading).toBe(true);
    expect(result.current.byTipo).toEqual({});
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.byTipo).toEqual({ dia_pago: { sent: 4, failed: 0, skipped: 1, lastSentAt: 't' } });
    expect(result.current.failed).toBe(false);
  });

  it('reports a failure without data and retries on demand', async () => {
    cases.loadNoticeActivityUseCase.mockRejectedValueOnce(new Error('sql: relation missing'));
    const { result } = renderHook(() => useNoticeActivity(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.byTipo).toEqual({});
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.failed).toBe(false));
    expect(cases.loadNoticeActivityUseCase).toHaveBeenCalledTimes(2);
    expect(result.current.byTipo.dia_pago?.sent).toBe(4);
  });
});

describe('useRecentNotices', () => {
  it('loads the first page without filters', async () => {
    const { result } = renderHook(() => useRecentNotices(), { wrapper: wrapper() });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(page));
    expect(cases.listRecentNoticesUseCase).toHaveBeenCalledWith(1, {});
    expect(result.current.filters).toEqual({});
    expect(result.current.error).toBeNull();
  });

  it('applies filters from the first page and pages through the notices', async () => {
    const { result } = renderHook(() => useRecentNotices(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toEqual(page));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(cases.listRecentNoticesUseCase).toHaveBeenLastCalledWith(2, {}));
    act(() => result.current.setFilters({ tipo: 'despedida', status: 'failed' }));
    await waitFor(() => expect(cases.listRecentNoticesUseCase).toHaveBeenLastCalledWith(1, { tipo: 'despedida', status: 'failed' }));
    expect(result.current.filters).toEqual({ tipo: 'despedida', status: 'failed' });
  });

  it('does not query while disabled and keeps the filters for when it is enabled', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useRecentNotices({ enabled }), {
      wrapper: wrapper(), initialProps: { enabled: false },
    });
    act(() => result.current.setFilters({ tipo: 'renovacion' }));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(cases.listRecentNoticesUseCase).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(cases.listRecentNoticesUseCase).toHaveBeenCalledWith(1, { tipo: 'renovacion' }));
  });

  it('shows a Spanish error without technical details and retries', async () => {
    cases.listRecentNoticesUseCase.mockRejectedValueOnce(new Error('sql: permission denied'));
    const { result } = renderHook(() => useRecentNotices(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.error).toBe('No se pudo cargar el historial de envíos. Inténtalo de nuevo.'));
    expect(result.current.error).not.toContain('sql');
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).toEqual(page));
    expect(result.current.error).toBeNull();
  });
});
