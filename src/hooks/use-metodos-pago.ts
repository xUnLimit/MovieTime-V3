"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMetodosPagoUseCase } from "@/application/use-cases/metodos-pago-use-cases";
import { queryKeys } from "@/platform/query-keys";

export function useMetodosPago() {
  return useQuery({
    queryKey: queryKeys.metodosPago.list("all"),
    queryFn: fetchMetodosPagoUseCase,
  });
}
