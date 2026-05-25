import { countNotificaciones } from "@/lib/supabase/notifications-repository";
import { queryNotificationsRead } from "@/lib/supabase/domain-read-adapters";
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
    : queryNotificationsRead([
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
    : queryNotificationsRead([
        { field: "entidad", operator: "==", value: "servicio" },
        { field: "servicioId", operator: "==", value: servicioId },
      ]);
}

export async function fetchNotificationCounts() {
  const [totalNotificaciones, ventasProximas, serviciosProximas, reposoCompletados] =
    await Promise.all([
      countNotificaciones(),
      countNotificaciones([{ field: "entidad", operator: "==", value: "venta" }]),
      countNotificaciones([{ field: "entidad", operator: "==", value: "servicio" }]),
      countNotificaciones([{ field: "entidad", operator: "==", value: "reposo" }]),
    ]);

  return {
    reposoCompletados,
    serviciosProximos: serviciosProximas,
    totalNotificaciones,
    ventasProximas,
  };
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
