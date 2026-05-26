"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getConfigUseCase } from "@/lib/use-cases/config-use-cases";

export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config.global(),
    queryFn: getConfigUseCase,
  });
}
