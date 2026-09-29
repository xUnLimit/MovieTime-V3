import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  update: vi.fn(), list: vi.fn(), refetch: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn(),
}));
vi.mock('@/application/use-cases/config-use-cases', () => ({
  updateWhatsAppAutoUseCase: mocks.update,
  listAutoNoticeRunsUseCase: mocks.list,
}));
vi.mock('@/hooks/use-config', () => {
  const data = { whatsapp: { prefijoTelefono: '507', autoEnabled: false, autoDailyCap: 200, autoSendHour: 9 } };
  return { useConfig: () => ({ data, refetch: mocks.refetch }) };
});
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

import { useWhatsAppAutoSettings } from './useWhatsAppAutoSettings';

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useWhatsAppAutoSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue(undefined);
    mocks.list.mockResolvedValue([]);
    mocks.refetch.mockResolvedValue(undefined);
  });

  it('persists the switch and refreshes the config', async () => {
    const { result } = renderHook(() => useWhatsAppAutoSettings(true), { wrapper });
    await act(async () => { await result.current.handleToggle(true); });
    expect(mocks.update).toHaveBeenCalledWith({ enabled: true });
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it('skips the write when the hour does not change and saves it otherwise', async () => {
    const { result } = renderHook(() => useWhatsAppAutoSettings(true), { wrapper });
    await act(async () => { await result.current.handleHourChange(9); });
    expect(mocks.update).not.toHaveBeenCalled();
    await act(async () => { await result.current.handleHourChange(14); });
    expect(mocks.update).toHaveBeenCalledWith({ horaEnvio: 14 });
  });

  it('rejects a cap outside 1..1000 without saving and restores the draft', async () => {
    const { result } = renderHook(() => useWhatsAppAutoSettings(true), { wrapper });
    await waitFor(() => expect(result.current.draftCap).toBe('200'));
    act(() => result.current.setDraftCap('5000'));
    await act(async () => { await result.current.handleCapCommit(); });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalled();
    expect(result.current.draftCap).toBe('200');
  });

  it('saves a valid cap and reports save errors', async () => {
    const { result } = renderHook(() => useWhatsAppAutoSettings(true), { wrapper });
    await waitFor(() => expect(result.current.draftCap).toBe('200'));
    act(() => result.current.setDraftCap('350'));
    await act(async () => { await result.current.handleCapCommit(); });
    expect(mocks.update).toHaveBeenCalledWith({ dailyCap: 350 });

    mocks.update.mockRejectedValueOnce(new Error('boom'));
    await act(async () => { await result.current.handleToggle(true); });
    expect(mocks.toastError).toHaveBeenCalled();
  });
});
