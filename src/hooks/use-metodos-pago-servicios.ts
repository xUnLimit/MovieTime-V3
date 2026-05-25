"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { queryMetodosPagoServiciosRead } from "@/lib/supabase/domain-read-adapters";

export function useMetodosPagoServicios() {
  return useQuery({
    queryKey: queryKeys.metodosPago.servicios(),
    queryFn: () => queryMetodosPagoServiciosRead({ soloActivos: true }),
  });
}
