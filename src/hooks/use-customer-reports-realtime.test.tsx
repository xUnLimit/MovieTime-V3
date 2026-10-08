import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReportRealtimeListener } from '@/platform/supabase/customer-reports-realtime';

const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('@/application/use-cases/customer-reports-use-cases', () => ({ subscribeToReportChanges: mocks.subscribe }));
import { useCustomerReportsRealtime } from './use-customer-reports-realtime';

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
it('coalesces changes, switches backup interval, refreshes on reconnect and cleans up', () => {
  vi.useFakeTimers();
  let listener: ReportRealtimeListener | undefined;
  mocks.subscribe.mockImplementation((next: ReportRealtimeListener) => { listener = next; return mocks.unsubscribe; });
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(({ enabled }) => useCustomerReportsRealtime(enabled), { wrapper, initialProps: { enabled: false } });
  expect(mocks.subscribe).not.toHaveBeenCalled();
  hook.rerender({ enabled: true });
  expect(hook.result.current).toBe(30_000);
  act(() => { listener?.onStatus('live'); listener?.onChange(); listener?.onChange(); });
  expect(hook.result.current).toBe(120_000);
  act(() => vi.advanceTimersByTime(250));
  expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: ['customer-reports'] });
  act(() => listener?.onStatus('offline'));
  expect(hook.result.current).toBe(30_000);
  act(() => listener?.onStatus('live'));
  act(() => vi.advanceTimersByTime(250));
  expect(invalidate).toHaveBeenCalledTimes(2);
  act(() => listener?.onChange());
  hook.unmount();
  act(() => vi.advanceTimersByTime(250));
  expect(invalidate).toHaveBeenCalledTimes(2);
  expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  client.clear();
});
