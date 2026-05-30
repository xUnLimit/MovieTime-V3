"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { fetchServiciosCountsUseCase } from "@/application/use-cases/servicios/servicios-query-use-cases";

export function useServiciosCounts() {
  return useQuery({
    queryKey: queryKeys.servicios.counts(),
    queryFn: fetchServiciosCountsUseCase,
  });
}
