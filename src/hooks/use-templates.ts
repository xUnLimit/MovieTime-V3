"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { fetchTemplatesUseCase } from "@/lib/use-cases/templates-use-cases";
import type { TemplateMensaje } from "@/types";

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => fetchTemplatesUseCase<TemplateMensaje>(),
  });
}
