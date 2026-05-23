"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getDashboardHome } from "@/lib/services/dashboardStatsService";

export function useDashboardHome() {
  return useQuery({
    queryKey: queryKeys.dashboard.home(),
    queryFn: getDashboardHome,
  });
}
