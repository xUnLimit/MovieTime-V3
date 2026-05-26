import {
  getServicioNotifications,
  getVentaNotifications,
  type NotificacionConId,
} from "@/lib/notifications/notification-helpers";
import {
  fetchNotificationCountsUseCase,
  queryNotificationsUseCase,
} from "@/lib/use-cases/notificaciones/notificaciones-query-use-cases";

export async function getVentaNotificationsToDelete(
  notificaciones: NotificacionConId[],
  ventaId: string,
) {
  const localNotifsToDelete = getVentaNotifications(notificaciones, ventaId);
  return localNotifsToDelete.length > 0
    ? localNotifsToDelete
    : queryNotificationsUseCase([
        { field: "entidad", operator: "==", value: "venta" },
        { field: "ventaId", operator: "==", value: ventaId },
      ]);
}

export async function getServicioNotificationsToDelete(
  notificaciones: NotificacionConId[],
  servicioId: string,
) {
  const localNotifsToDelete = getServicioNotifications(notificaciones, servicioId);
  return localNotifsToDelete.length > 0
    ? localNotifsToDelete
    : queryNotificationsUseCase([
        { field: "entidad", operator: "==", value: "servicio" },
        { field: "servicioId", operator: "==", value: servicioId },
      ]);
}

export async function fetchNotificationCounts() {
  return fetchNotificationCountsUseCase();
}

export function updateNotificationFlag(
  notificaciones: NotificacionConId[],
  notifId: string,
  patch: Partial<Pick<NotificacionConId, "leida" | "resaltada">>,
) {
  return notificaciones.map((notificacion) =>
    notificacion.id === notifId ? { ...notificacion, ...patch } : notificacion,
  );
}
