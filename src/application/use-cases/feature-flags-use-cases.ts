import {
  fetchFeatureFlags,
  type FeatureFlagMap,
} from '@/platform/supabase/feature-flags-repository';

export type { FeatureFlagMap };

export async function fetchFeatureFlagsUseCase(): Promise<FeatureFlagMap> {
  const flags = await fetchFeatureFlags();
  return Object.fromEntries(
    Object.entries(flags).map(([key, enabled]) => [key, Boolean(enabled)]),
  );
}

export function resolveFeatureFlagUseCase(
  flags: FeatureFlagMap | undefined,
  key: string,
  fallback = false,
): boolean {
  return flags?.[key] ?? fallback;
}
