import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn() }));
vi.mock('@/application/use-cases/customer-reports-use-cases', () => ({ listCustomerReportsUseCase: mocks.list, updateCustomerReportUseCase: mocks.update }));
import { useCustomerReports } from './use-customer-reports';
it('fetches paginated reports, refetches after updates and does not query for unauthorized UI', async () => {
  mocks.list.mockResolvedValue({ reports: [], total: 0 }); mocks.update.mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(({ enabled }) => useCustomerReports({ page: 1, status: 'open' }, enabled), { wrapper, initialProps: { enabled: false } });
  expect(mocks.list).not.toHaveBeenCalled(); hook.rerender({ enabled: true }); await waitFor(() => expect(hook.result.current.query.isSuccess).toBe(true));
  const input = { id: '00000000-0000-4000-8000-000000000001', status: 'resolved' as const, version: 0 };
  await act(() => hook.result.current.change.mutateAsync(input)); expect(mocks.update).toHaveBeenCalledWith(input, expect.anything());
  await waitFor(() => expect(mocks.list.mock.calls.length).toBeGreaterThan(1)); hook.unmount(); client.clear();
});
it('uses the Realtime backup interval instead of polling every fifteen seconds', async () => {
  vi.useFakeTimers(); mocks.list.mockClear(); mocks.list.mockResolvedValue({ reports: [], total: 0 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useCustomerReports({ page: 1, status: 'open' }, true, 120_000), { wrapper });
  try {
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.list).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(mocks.list).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(105_000); });
    expect(mocks.list).toHaveBeenCalledTimes(2);
  } finally { hook.unmount(); client.clear(); vi.useRealTimers(); }
});
