"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getConfig } from "@/lib/supabase/config-repository";

export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config.global(),
    queryFn: getConfig,
  });
}
