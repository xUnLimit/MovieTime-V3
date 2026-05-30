"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { fetchCategoriasCounts } from "@/lib/use-cases/categorias-use-cases";

export function useCategoriasCounts() {
  return useQuery({
    queryKey: queryKeys.categorias.counts(),
    queryFn: fetchCategoriasCounts,
  });
}
