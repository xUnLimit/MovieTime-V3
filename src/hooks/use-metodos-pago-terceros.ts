"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { queryMetodosPago } from "@/lib/supabase/catalogos-repository";
import type { MetodoPago } from "@/types";

export function useMetodosPagoTerceros(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.metodosPago.terceros(),
    queryFn: () =>
      queryMetodosPago<MetodoPago>([
        { field: "asociadoA", operator: "==", value: "tercero" },
        { field: "activo", operator: "==", value: true },
      ]),
    enabled: options.enabled,
  });
}
