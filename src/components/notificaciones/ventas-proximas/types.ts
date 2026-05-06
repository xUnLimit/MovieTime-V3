import type { Notificacion, NotificacionVenta } from '@/types/notificaciones';

export type NotificacionConId = Notificacion & { id: string };
export type NotificacionVentaConId = NotificacionVenta & { id: string };

export type VentaNotificationAction = (
  notif: NotificacionVentaConId
) => void | Promise<void>;

export type ToggleLeidaHandler = (
  notifId: string,
  leida: boolean
) => void | Promise<void>;

export type CopyToClipboardHandler = (
  text: string,
  label: string
) => Promise<void>;
