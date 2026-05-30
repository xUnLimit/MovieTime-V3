"use client";

import { useQuery } from "@tanstack/react-query";

import {
  queryNotificationsUseCase,
  type NotificacionConId,
} from "@/application/use-cases/notificaciones/notificaciones-query-use-cases";
import { queryKeys } from "@/platform/query-keys";
export type { NotificacionConId };

export function useNotificaciones() {
  return useQuery({
    queryKey: queryKeys.notificaciones.lists(),
    queryFn: () => queryNotificationsUseCase(),
  });
}
