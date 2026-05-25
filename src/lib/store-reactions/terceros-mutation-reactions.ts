import { storeEventBus } from '@/lib/events/store-event-bus';
import { refreshNotificationListCache } from '@/lib/store-reactions/notification-cache-reactions';

export async function afterTerceroUpdated({
  terceroId,
  shouldRefreshNotificaciones,
  shouldDispatchTerceroNombreUpdated,
}: {
  terceroId: string;
  shouldRefreshNotificaciones: boolean;
  shouldDispatchTerceroNombreUpdated: boolean;
}) {
  if (shouldRefreshNotificaciones) {
    await refreshNotificationListCache();
  }

  if (shouldDispatchTerceroNombreUpdated) {
    storeEventBus.emit({ type: 'TERCERO_NOMBRE_UPDATED', terceroId });
  }
}

export async function afterTerceroDeleted(terceroId: string) {
  storeEventBus.emit({ type: 'TERCERO_DELETED', terceroId });
}
