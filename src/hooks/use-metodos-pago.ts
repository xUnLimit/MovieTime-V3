"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { fetchMetodosPagoUseCase } from "@/lib/use-cases/catalogos-use-cases";
import type { MetodoPago } from "@/types";

export function useMetodosPago() {
  return useQuery({
    queryKey: queryKeys.metodosPago.list("all"),
    queryFn: () => fetchMetodosPagoUseCase<MetodoPago>(),
  });
}
