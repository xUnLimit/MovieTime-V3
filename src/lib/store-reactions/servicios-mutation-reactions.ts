import { syncServicioForecastReadModels } from '@/lib/forecasting';
import { safeAsyncSideEffect } from '@/platform/utils/safety';
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

// NOTE: estas reacciones NO emiten eventos de dominio (SERVICIO_CREATED/UPDATED/DELETED).
// El use-case es el unico emisor del hecho de dominio (ver servicios-write-use-cases.ts).
export async function afterServicioCreated(servicioId: string) {
  syncServicioForecastReadModels(servicioId);
}

export async function afterServicioUpdated(servicioId: string) {
  syncServicioForecastReadModels(servicioId);
}

export async function afterServicioDeleted(servicioId: string) {
  deleteServicioNotifications(servicioId);
  syncServicioForecastReadModels(servicioId);
}
