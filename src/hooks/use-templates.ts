"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchTemplatesUseCase } from "@/application/use-cases/templates-use-cases";
import { queryKeys } from "@/platform/query-keys";

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: fetchTemplatesUseCase,
  });
}
