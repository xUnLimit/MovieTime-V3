"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { getMetodosPago } from "@/platform/supabase/catalogos-repository";
import type { MetodoPago } from "@/types";

export function useMetodosPago() {
  return useQuery({
    queryKey: queryKeys.metodosPago.list("all"),
    queryFn: () => getMetodosPago<MetodoPago>(),
  });
}
