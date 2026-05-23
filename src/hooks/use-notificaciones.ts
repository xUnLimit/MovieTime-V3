"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { queryNotifications } from "@/lib/supabase/notifications-repository";
import type { Notificacion } from "@/types/notificaciones";

export type NotificacionConId = Notificacion & { id: string };

export function useNotificaciones() {
  return useQuery({
    queryKey: queryKeys.notificaciones.lists(),
    queryFn: () => queryNotifications<NotificacionConId>([]),
  });
}
