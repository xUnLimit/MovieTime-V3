"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { queryMetodosPagoServiciosUseCase } from "@/lib/use-cases/metodos-pago-use-cases";

export function useMetodosPagoServicios() {
  return useQuery({
    queryKey: queryKeys.metodosPago.servicios(),
    queryFn: () => queryMetodosPagoServiciosUseCase({ soloActivos: true }),
  });
}
