import { toast } from 'sonner';

import { invalidateDashboardCache } from '@/lib/commands/client-cache';
import {
  cutVentaFromNotificationStoreWorkflow,
  inactivateServicioFromNotificationStoreWorkflow,
  refreshVentasStoreCache,
} from '@/lib/store-reactions/notificaciones-workflow-reactions';

type RefreshNotificationCaches = () => Promise<void>;

export type NotificationActionOutcome = {
  completed: true;
  cacheInvalidations: Array<{ entity: 'venta' | 'servicio'; entityId: string }>;
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

  invalidateDashboardCache({
    entity: 'venta',
    entityId: ventaId,
  });

  toast.success('Venta cortada exitosamente');
  refreshVentasStoreCache();

  return {
    completed: true,
    cacheInvalidations: [{ entity: 'venta', entityId: ventaId }],
    storeRefreshes: ['ventas', 'notificaciones'],
  };
}

export async function inactivateServicioFromNotificationUseCase({
  refreshNotificationCaches,
  servicioId,
  servicioNombre,
}: {
  refreshNotificationCaches: RefreshNotificationCaches;
  servicioId: string;
  servicioNombre: string;
}): Promise<NotificationActionOutcome> {
  await inactivateServicioFromNotificationStoreWorkflow(servicioId);
  toast.success('Servicio inactivado', {
    description: `${servicioNombre} ha sido marcado como inactivo.`,
  });
  await refreshNotificationCaches();

  return {
    completed: true,
    cacheInvalidations: [{ entity: 'servicio', entityId: servicioId }],
    storeRefreshes: ['servicios', 'notificaciones'],
  };
}
