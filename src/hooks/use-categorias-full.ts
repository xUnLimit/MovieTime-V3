"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { fetchCategoriasFull } from "@/lib/use-cases/categorias-use-cases";
import type { Categoria } from "@/types";

export function useCategoriasFull() {
  return useQuery({
    queryKey: queryKeys.categorias.full(),
    queryFn: () => fetchCategoriasFull() as Promise<Categoria[]>,
  });
}
