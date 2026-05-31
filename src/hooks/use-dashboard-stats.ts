"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { getDashboardStats } from "@/modules/dashboard-read-models";

// get_dashboard_stats_live es un read-model caro (UNION ALL de varias fuentes).
// Las mutaciones invalidan queryKeys.dashboard.all, así que el staleTime largo solo
// recorta el refetch pasivo sin retrasar cambios reales.
const DASHBOARD_STALE_MS = 5 * 60 * 1000;

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: getDashboardStats,
    staleTime: DASHBOARD_STALE_MS,
  });
}
