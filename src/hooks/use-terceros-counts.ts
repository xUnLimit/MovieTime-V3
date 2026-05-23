"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { fetchTercerosCountsUseCase } from "@/lib/use-cases/terceros-use-cases";

export function useTercerosCounts() {
  return useQuery({
    queryKey: queryKeys.terceros.counts(),
    queryFn: fetchTercerosCountsUseCase,
  });
}
