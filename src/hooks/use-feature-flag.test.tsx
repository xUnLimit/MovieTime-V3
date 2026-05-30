import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const featureFlagMocks = vi.hoisted(() => ({
  fetchFeatureFlags: vi.fn(),
}));

vi.mock('@/platform/supabase/feature-flags-repository', () => ({
  fetchFeatureFlags: featureFlagMocks.fetchFeatureFlags,
}));

import { useFeatureFlag } from './use-feature-flag';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useFeatureFlag', () => {
  beforeEach(() => {
    featureFlagMocks.fetchFeatureFlags.mockReset();
  });

  it('returns the enabled state from the feature flag query', async () => {
    featureFlagMocks.fetchFeatureFlags.mockResolvedValue({ enterprise_mode: true });

    const { result } = renderHook(() => useFeatureFlag('enterprise_mode'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('uses the fallback when a flag is missing', async () => {
    featureFlagMocks.fetchFeatureFlags.mockResolvedValue({});

    const { result } = renderHook(() => useFeatureFlag('missing_flag', true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(featureFlagMocks.fetchFeatureFlags).toHaveBeenCalled();
    });

    expect(result.current).toBe(true);
  });

});
