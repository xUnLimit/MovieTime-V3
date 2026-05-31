import { beforeEach, describe, expect, it, vi } from 'vitest';

const featureFlagMocks = vi.hoisted(() => ({
  fetchFeatureFlags: vi.fn(),
}));

vi.mock('@/platform/supabase/feature-flags-repository', () => ({
  fetchFeatureFlags: featureFlagMocks.fetchFeatureFlags,
}));

import {
  fetchFeatureFlagsUseCase,
  resolveFeatureFlagUseCase,
} from './feature-flags-use-cases';

describe('feature flag use-cases', () => {
  beforeEach(() => {
    featureFlagMocks.fetchFeatureFlags.mockReset();
  });

  it('normalizes repository values to booleans', async () => {
    featureFlagMocks.fetchFeatureFlags.mockResolvedValue({
      servicios_metrics: 1,
      enterprise_mode: 0,
    });

    await expect(fetchFeatureFlagsUseCase()).resolves.toEqual({
      servicios_metrics: true,
      enterprise_mode: false,
    });
  });

  it('resolves missing flags through the caller fallback', () => {
    expect(resolveFeatureFlagUseCase({ servicios_metrics: true }, 'missing', true)).toBe(true);
    expect(resolveFeatureFlagUseCase({ servicios_metrics: true }, 'servicios_metrics', false)).toBe(true);
  });
});
