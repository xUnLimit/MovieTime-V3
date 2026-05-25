"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { queryMetodosPagoTercerosRead } from "@/lib/supabase/domain-read-adapters";

export function useMetodosPagoTerceros(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.metodosPago.terceros(),
    queryFn: () => queryMetodosPagoTercerosRead({ soloActivos: true }),
    enabled: options.enabled,
  });
}
