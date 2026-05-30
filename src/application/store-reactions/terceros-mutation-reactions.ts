import { refreshNotificationListCache } from '@/application/store-reactions/notification-cache-reactions';

// NOTE: esta reaccion NO emite eventos de dominio (TERCERO_NOMBRE_UPDATED/TERCERO_DELETED).
// El use-case es el unico emisor (ver terceros-use-cases.ts). Aqui solo se refresca la cache
// de notificaciones cuando cambian datos que afectan a las notificaciones existentes.
export async function afterTerceroUpdated({
  shouldRefreshNotificaciones,
}: {
  terceroId: string;
  shouldRefreshNotificaciones: boolean;
  shouldDispatchTerceroNombreUpdated: boolean;
}) {
  if (shouldRefreshNotificaciones) {
    await refreshNotificationListCache();
  }
}
