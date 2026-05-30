"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { fetchVentasCountsUseCase } from "@/lib/use-cases/ventas/ventas-query-use-cases";

export function useVentasCounts() {
  return useQuery({
    queryKey: queryKeys.ventas.counts(),
    queryFn: fetchVentasCountsUseCase,
  });
}
