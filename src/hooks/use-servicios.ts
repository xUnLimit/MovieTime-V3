"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchServiciosUseCase } from "@/application/use-cases/servicios/servicios-query-use-cases";
import { queryKeys } from "@/platform/query-keys";

export function useServicios() {
  return useQuery({
    queryKey: queryKeys.servicios.lists(),
    queryFn: fetchServiciosUseCase,
  });
}
