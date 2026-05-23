"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { fetchMetodosPagoCountsUseCase } from "@/lib/use-cases/catalogos-use-cases";

export function useMetodosPagoCounts() {
  return useQuery({
    queryKey: queryKeys.metodosPago.counts(),
    queryFn: fetchMetodosPagoCountsUseCase,
  });
}
