import {
  fetchFeatureFlags,
  type FeatureFlagMap,
} from '@/platform/supabase/feature-flags-repository';

export type { FeatureFlagMap };

export function fetchFeatureFlagsUseCase() {
  return fetchFeatureFlags();
}
