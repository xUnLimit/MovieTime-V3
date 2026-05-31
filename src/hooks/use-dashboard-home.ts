"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { getDashboardHome } from "@/modules/dashboard-read-models";

// La RPC get_dashboard_home re-agrega todo el histórico en cada llamada (~200ms).
// Las mutaciones de venta/pago/gasto invalidan queryKeys.dashboard.all, así que un
// staleTime largo no retrasa los cambios reales; solo reduce el refetch pasivo.
const DASHBOARD_STALE_MS = 5 * 60 * 1000;

export function useDashboardHome() {
  return useQuery({
    queryKey: queryKeys.dashboard.home(),
    queryFn: getDashboardHome,
    staleTime: DASHBOARD_STALE_MS,
  });
}
