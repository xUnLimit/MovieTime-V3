"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { fetchServiciosCountsUseCase } from "@/lib/use-cases/servicios/servicios-query-use-cases";

export function useServiciosCounts() {
  return useQuery({
    queryKey: queryKeys.servicios.counts(),
    queryFn: fetchServiciosCountsUseCase,
  });
}
