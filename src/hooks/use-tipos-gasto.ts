"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { fetchTiposGastoUseCase } from "@/application/use-cases/gastos-use-cases";
import type { TipoGasto } from "@/types";

export function useTiposGasto() {
  return useQuery({
    queryKey: queryKeys.tiposGasto.list(),
    queryFn: () => fetchTiposGastoUseCase<TipoGasto>(),
  });
}
