"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { fetchMetodosPagoByFiltersUseCase } from "@/lib/use-cases/catalogos-use-cases";
import type { MetodoPago } from "@/types";

export function useMetodosPagoTerceros(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.metodosPago.terceros(),
    queryFn: () =>
      fetchMetodosPagoByFiltersUseCase<MetodoPago>([
        { field: "asociadoA", operator: "==", value: "tercero" },
        { field: "activo", operator: "==", value: true },
      ]),
    enabled: options.enabled,
  });
}
