import type {
  Notificacion,
  NotificacionReposo,
  NotificacionServicio,
  NotificacionVenta,
} from "@/types/notificaciones";
import {
  esNotificacionReposo,
  esNotificacionServicio,
  esNotificacionVenta,
} from "@/types/notificaciones";

export type NotificacionConId = Notificacion & { id: string };

export interface NotificationCountState {
  reposoCompletados: number;
  serviciosProximos: number;
  totalNotificaciones: number;
  ventasProximas: number;
}

export interface NotificationRollbackState extends NotificationCountState {
  notificaciones: NotificacionConId[];
}

export function getNotificationCounts(
  notificaciones: NotificacionConId[],
): NotificationCountState {
  return {
    totalNotificaciones: notificaciones.length,
    ventasProximas: notificaciones.filter(esNotificacionVenta).length,
    serviciosProximos: notificaciones.filter(esNotificacionServicio).length,
    reposoCompletados: notificaciones.filter(esNotificacionReposo).length,
  };
}

export function getNotificationListState(
  notificaciones: NotificacionConId[],
): NotificationRollbackState {
  return {
    notificaciones,
    ...getNotificationCounts(notificaciones),
  };
}

export function getVentaNotifications(
  notificaciones: NotificacionConId[],
  ventaId: string,
) {
  return notificaciones.filter(
    (n): n is NotificacionVenta & { id: string } =>
      esNotificacionVenta(n) && n.ventaId === ventaId,
  );
}

export function getServicioNotifications(
  notificaciones: NotificacionConId[],
  servicioId: string,
) {
  return notificaciones.filter(
    (n): n is NotificacionServicio & { id: string } =>
      esNotificacionServicio(n) && n.servicioId === servicioId,
  );
}

export function removeVentaNotifications(
  notificaciones: NotificacionConId[],
  ventaId: string,
) {
  return notificaciones.filter(
    (n) => !(esNotificacionVenta(n) && n.ventaId === ventaId),
  );
}

export function removeServicioNotifications(
  notificaciones: NotificacionConId[],
  servicioId: string,
) {
  return notificaciones.filter(
    (n) => !(esNotificacionServicio(n) && n.servicioId === servicioId),
  );
}

export function getTypedVentaNotifications(
  notificaciones: NotificacionConId[],
) {
  return notificaciones.filter(esNotificacionVenta) as Array<
    NotificacionVenta & { id: string }
  >;
}

export function getTypedServicioNotifications(
  notificaciones: NotificacionConId[],
) {
  return notificaciones.filter(esNotificacionServicio) as Array<
    NotificacionServicio & { id: string }
  >;
}

export function getTypedReposoNotifications(
  notificaciones: NotificacionConId[],
) {
  return notificaciones.filter(esNotificacionReposo) as Array<
    NotificacionReposo & { id: string }
  >;
}
