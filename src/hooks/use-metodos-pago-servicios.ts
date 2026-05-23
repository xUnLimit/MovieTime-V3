"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { fetchMetodosPagoByFiltersUseCase } from "@/lib/use-cases/catalogos-use-cases";
import type { MetodoPago } from "@/types";

export function useMetodosPagoServicios() {
  return useQuery({
    queryKey: queryKeys.metodosPago.servicios(),
    queryFn: () =>
      fetchMetodosPagoByFiltersUseCase<MetodoPago>([
        { field: "asociadoA", operator: "==", value: "servicio" },
        { field: "activo", operator: "==", value: true },
      ]),
  });
}
