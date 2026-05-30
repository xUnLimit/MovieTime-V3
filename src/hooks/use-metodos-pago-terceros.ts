"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { queryMetodosPagoTercerosUseCase } from "@/application/use-cases/metodos-pago-use-cases";

export function useMetodosPagoTerceros(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.metodosPago.terceros(),
    queryFn: () => queryMetodosPagoTercerosUseCase({ soloActivos: true }),
    enabled: options.enabled,
  });
}
