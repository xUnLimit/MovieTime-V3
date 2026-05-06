import type {
  Notificacion,
  NotificacionServicio,
} from '@/types/notificaciones';

export type NotificacionConId = Notificacion & { id: string };
export type NotificacionServicioConId = NotificacionServicio & { id: string };

export type ServicioNotificationAction = (
  notif: NotificacionServicioConId
) => void | Promise<void>;

export type ToggleLeidaHandler = (
  notifId: string,
  leida: boolean
) => void | Promise<void>;

export type CopyToClipboardHandler = (
  text: string,
  label: string
) => Promise<void>;
