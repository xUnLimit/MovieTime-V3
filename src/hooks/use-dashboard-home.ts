"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getDashboardHome } from "@/lib/dashboard-read-models";

export function useDashboardHome() {
  return useQuery({
    queryKey: queryKeys.dashboard.home(),
    queryFn: getDashboardHome,
  });
}
