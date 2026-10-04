import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useCases = vi.hoisted(() => ({ loadBotAdminSnapshot: vi.fn(), loadBotHealthUseCase: vi.fn() }));
vi.mock('@/application/use-cases/bot-admin-use-cases', () => useCases);

import { addPurchaseFlow, defaultDefinition } from '@/modules/bot-config';
import { usePurchaseFlowInCanvas } from './use-purchase-flow-in-canvas';

function mount(enabled = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => usePurchaseFlowInCanvas(enabled), { wrapper });
}
const snapshot = (published: unknown) => ({ status: { enabled: true, publishedVersion: 1, updatedAt: null }, published, versions: [] });

beforeEach(() => {
  Object.values(useCases).forEach((mock) => mock.mockReset());
  useCases.loadBotHealthUseCase.mockResolvedValue({ purchaseBlocksEnabled: true });
  useCases.loadBotAdminSnapshot.mockResolvedValue(snapshot(addPurchaseFlow(defaultDefinition())));
});

describe('usePurchaseFlowInCanvas', () => {
  it('is true only when the server flag is on and the published flow already has purchase blocks', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays false while the flag is off, the published flow has no blocks, or it cannot be read', async () => {
    useCases.loadBotHealthUseCase.mockResolvedValue({ purchaseBlocksEnabled: false });
    const off = mount();
    await waitFor(() => expect(useCases.loadBotHealthUseCase).toHaveBeenCalled());
    expect(off.result.current).toBe(false);
    useCases.loadBotHealthUseCase.mockResolvedValue({ purchaseBlocksEnabled: true });
    useCases.loadBotAdminSnapshot.mockResolvedValue(snapshot(defaultDefinition()));
    const none = mount();
    await waitFor(() => expect(useCases.loadBotAdminSnapshot).toHaveBeenCalledTimes(2));
    expect(none.result.current).toBe(false);
    useCases.loadBotAdminSnapshot.mockRejectedValue(new Error('x'));
    const failed = mount();
    await waitFor(() => expect(useCases.loadBotAdminSnapshot).toHaveBeenCalledTimes(3));
    expect(failed.result.current).toBe(false);
  });

  it('does not query anything for non administrators', () => {
    const { result } = mount(false);
    expect(result.current).toBe(false);
    expect(useCases.loadBotHealthUseCase).not.toHaveBeenCalled();
  });
});
