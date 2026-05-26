import { storeEventBus } from '@/lib/events/store-event-bus';
import { syncServicioForecastReadModels } from '@/lib/forecasting';
import { safeAsyncSideEffect } from '@/lib/utils/safety';
import { deleteServicioNotificationStoreCache } from '@/lib/store-reactions/notification-cache-reactions';

function deleteServicioNotifications(servicioId: string) {
  safeAsyncSideEffect(
    Promise.resolve().then(() =>
      deleteServicioNotificationStoreCache(servicioId),
    ),
    {
      operation: 'deleteNotificacionesPorServicio',
      entity: 'servicio',
      entityId: servicioId,
      critical: true,
    },
  );
}

export async function afterServicioCreated(servicioId: string) {
  syncServicioForecastReadModels(servicioId);
  storeEventBus.emit({ type: 'SERVICIO_CREATED', servicioId });
}

export async function afterServicioUpdated(servicioId: string) {
  syncServicioForecastReadModels(servicioId);
  storeEventBus.emit({ type: 'SERVICIO_UPDATED', servicioId });
}

export async function afterServicioDeleted(servicioId: string) {
  deleteServicioNotifications(servicioId);
  syncServicioForecastReadModels(servicioId);
  storeEventBus.emit({ type: 'SERVICIO_DELETED', servicioId });
}
