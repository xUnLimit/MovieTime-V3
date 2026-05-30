"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { getConfigUseCase } from "@/application/use-cases/config-use-cases";

export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config.global(),
    queryFn: getConfigUseCase,
  });
}
