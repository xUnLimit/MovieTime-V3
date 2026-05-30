"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import { getServicios } from "@/platform/supabase/servicios-repository";
import type { Servicio } from "@/types/servicios";

export function useServicios() {
  return useQuery({
    queryKey: queryKeys.servicios.lists(),
    queryFn: () => getServicios<Servicio>(),
  });
}
