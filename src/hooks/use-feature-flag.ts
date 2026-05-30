"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import {
  fetchFeatureFlags,
  type FeatureFlagMap,
} from "@/platform/supabase/feature-flags-repository";

function useFeatureFlagsQuery() {
  return useQuery<FeatureFlagMap>({
    queryKey: queryKeys.featureFlags.all,
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFeatureFlag(key: string, fallback = false): boolean {
  const { data } = useFeatureFlagsQuery();
  return data?.[key] ?? fallback;
}
