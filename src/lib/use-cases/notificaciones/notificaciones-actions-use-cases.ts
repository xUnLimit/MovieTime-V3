import {
  cutVentaFromNotificationStoreWorkflow,
  inactivateServicioFromNotificationStoreWorkflow,
  refreshVentasStoreCache,
} from '@/lib/store-reactions/notificaciones-workflow-reactions';

type RefreshNotificationCaches = () => Promise<void>;

export type NotificationActionOutcome = {
  completed: true;
  cacheInvalidations: Array<{ entity: 'venta' | 'servicio'; entityId: string }>;
  notificationInvalidationNeeded: boolean;
  storeRefreshes: Array<'ventas' | 'servicios' | 'notificaciones'>;
};

export async function cutVentaFromNotificationUseCase({
  motivoCorte,
  refreshNotificationCaches,
  ventaId,
}: {
  motivoCorte: string;
  refreshNotificationCaches: RefreshNotificationCaches;
  ventaId: string;
}): Promise<NotificationActionOutcome> {
  await cutVentaFromNotificationStoreWorkflow(ventaId, motivoCorte);
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
  refreshNotificationCaches,
  servicioId,
}: {
  refreshNotificationCaches: RefreshNotificationCaches;
  servicioId: string;
  servicioNombre?: string;
}): Promise<NotificationActionOutcome> {
  await inactivateServicioFromNotificationStoreWorkflow(servicioId);
  await refreshNotificationCaches();

  return {
    completed: true,
    cacheInvalidations: [{ entity: 'servicio', entityId: servicioId }],
    notificationInvalidationNeeded: true,
    storeRefreshes: ['servicios', 'notificaciones'],
  };
}
