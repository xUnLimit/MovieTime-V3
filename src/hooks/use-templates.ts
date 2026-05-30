"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { getTemplates } from "@/platform/supabase/templates-repository";
import type { TemplateMensaje } from "@/types";

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => getTemplates<TemplateMensaje>(),
  });
}
