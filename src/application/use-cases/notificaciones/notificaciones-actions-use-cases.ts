import type { ActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import {
  cutVentaFromNotificationStoreWorkflow,
  inactivateServicioFromNotificationStoreWorkflow,
  refreshVentasStoreCache,
} from '@/application/store-reactions/notificaciones-workflow-reactions';

type RefreshNotificationCaches = () => Promise<void>;

export type NotificationActionOutcome = {
  completed: true;
  cacheInvalidations: Array<{ entity: 'venta' | 'servicio'; entityId: string }>;
  notificationInvalidationNeeded: boolean;
  storeRefreshes: Array<'ventas' | 'servicios' | 'notificaciones'>;
};

export async function cutVentaFromNotificationUseCase({
  log,
  motivoCorte,
  refreshNotificationCaches,
  ventaId,
}: {
  log: ActivityLogOptions;
  motivoCorte: string;
  refreshNotificationCaches: RefreshNotificationCaches;
  ventaId: string;
}): Promise<NotificationActionOutcome> {
  await cutVentaFromNotificationStoreWorkflow(ventaId, motivoCorte, log);
  await refreshNotificationCaches();

  refreshVentasStoreCache();

  return {
    completed: true,
    cacheInvalidations: [{ entity: 'venta', entityId: ventaId }],
    notificationInvalidationNeeded: true,
    storeRefreshes: ['ventas', 'notificaciones'],
  };
}

export async function inactivateServicioFromNotificationUseCase({
  log,
  refreshNotificationCaches,
  servicioId,
}: {
  log: ActivityLogOptions;
  refreshNotificationCaches: RefreshNotificationCaches;
  servicioId: string;
  servicioNombre?: string;
}): Promise<NotificationActionOutcome> {
  await inactivateServicioFromNotificationStoreWorkflow(servicioId, log);
  await refreshNotificationCaches();

  return {
    completed: true,
    cacheInvalidations: [{ entity: 'servicio', entityId: servicioId }],
    notificationInvalidationNeeded: true,
    storeRefreshes: ['servicios', 'notificaciones'],
  };
}
