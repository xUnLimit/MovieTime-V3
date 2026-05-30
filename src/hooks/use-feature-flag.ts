"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchFeatureFlagsUseCase,
  type FeatureFlagMap,
} from "@/application/use-cases/feature-flags-use-cases";
import { queryKeys } from "@/platform/query-keys";

function useFeatureFlagsQuery() {
  return useQuery<FeatureFlagMap>({
    queryKey: queryKeys.featureFlags.all,
    queryFn: fetchFeatureFlagsUseCase,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFeatureFlag(key: string, fallback = false): boolean {
  const { data } = useFeatureFlagsQuery();
  return data?.[key] ?? fallback;
}
