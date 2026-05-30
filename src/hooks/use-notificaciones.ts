"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/platform/query-keys";
import {
  queryNotificationsRead,
  type NotificacionConId,
} from "@/platform/supabase/domain-read-adapters";
export type { NotificacionConId };

export function useNotificaciones() {
  return useQuery({
    queryKey: queryKeys.notificaciones.lists(),
    queryFn: () => queryNotificationsRead(),
  });
}
