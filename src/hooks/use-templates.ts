"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getTemplates } from "@/lib/supabase/templates-repository";
import type { TemplateMensaje } from "@/types";

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: () => getTemplates<TemplateMensaje>(),
  });
}
