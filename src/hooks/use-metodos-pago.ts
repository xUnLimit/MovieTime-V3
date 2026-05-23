"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getMetodosPago } from "@/lib/supabase/catalogos-repository";
import type { MetodoPago } from "@/types";

export function useMetodosPago() {
  return useQuery({
    queryKey: queryKeys.metodosPago.list("all"),
    queryFn: () => getMetodosPago<MetodoPago>(),
  });
}
