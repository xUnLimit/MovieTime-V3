"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { fetchGastosUseCase } from "@/lib/use-cases/gastos-use-cases";
import type { Gasto } from "@/types";

export function useGastos() {
  return useQuery({
    queryKey: queryKeys.gastos.list(),
    queryFn: () => fetchGastosUseCase<Gasto>(),
  });
}
