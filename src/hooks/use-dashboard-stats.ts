"use client";

import { useQuery } from "@tanstack/react-query";

import { getDashboardStats } from "@/modules/dashboard-read-models";
import { queryKeys } from "@/platform/query-keys";

// El dashboard lee un snapshot server-side. El staleTime evita refetch pasivo
// repetido; la frescura real la gobierna Postgres con dirty state + pg_cron.
const DASHBOARD_STALE_MS = 5 * 60 * 1000;

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: getDashboardStats,
    staleTime: DASHBOARD_STALE_MS,
  });
}
