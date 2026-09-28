import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn(), status: vi.fn() }));
vi.mock('@/application/use-cases/whatsapp-notices-use-cases', () => ({
  sendWhatsAppNoticesUseCase: mocks.send,
  getVentaNoticeStatusUseCase: mocks.status,
}));

import { useSendNotices, useVentaNoticeStatus } from './use-whatsapp-notices';

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useSendNotices', () => {
  it('invalidates notice status queries after sending', async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    mocks.send.mockResolvedValue([]);
    const { result } = renderHook(() => useSendNotices(), { wrapper: wrapper(client) });
    await act(async () => { await result.current.mutateAsync({ tipo: 'dia_pago', ventaIds: ['v1'] }); });
    expect(mocks.send).toHaveBeenCalledWith({ tipo: 'dia_pago', ventaIds: ['v1'] }, expect.anything());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'notice-status'] });
  });
});

describe('useVentaNoticeStatus', () => {
  it('dedupes and sorts ids, and stays idle without ids', async () => {
    mocks.status.mockResolvedValue({});
    const client = new QueryClient();
    const { result } = renderHook(() => useVentaNoticeStatus(['b', 'a', 'b']), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.status).toHaveBeenCalledWith(['a', 'b']);
    mocks.status.mockClear();
    renderHook(() => useVentaNoticeStatus([]), { wrapper: wrapper(client) });
    expect(mocks.status).not.toHaveBeenCalled();
  });
});
