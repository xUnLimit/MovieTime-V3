import { queryNotifications } from "@/lib/supabase/notifications-repository";
import {
  getServicioNotifications,
  getVentaNotifications,
  type NotificacionConId,
} from "@/lib/notifications/notification-store-state";

export async function getVentaNotificationsToDelete(
  notificaciones: NotificacionConId[],
  ventaId: string,
) {
  const localNotifsToDelete = getVentaNotifications(notificaciones, ventaId);
  return localNotifsToDelete.length > 0
    ? localNotifsToDelete
    : queryNotifications<NotificacionConId>([
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
    : queryNotifications<NotificacionConId>([
        { field: "entidad", operator: "==", value: "servicio" },
        { field: "servicioId", operator: "==", value: servicioId },
      ]);
}
