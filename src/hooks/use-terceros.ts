"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { fetchTercerosUseCase } from "@/lib/use-cases/terceros-use-cases";
import type { Tercero } from "@/types";

export function useTerceros(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.terceros.list("all"),
    queryFn: () => fetchTercerosUseCase<Tercero>(),
    enabled: options.enabled ?? true,
  });
}
