import { toast } from 'sonner';

import { invalidateDashboardCache } from '@/lib/commands/client-cache';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useServiciosStore } from '@/store/serviciosStore';
import { useVentasStore } from '@/store/ventasStore';

type RefreshNotificationCaches = () => Promise<void>;

export async function cutVentaFromNotificationUseCase({
  motivoCorte,
  refreshNotificationCaches,
  ventaId,
}: {
  motivoCorte: string;
  refreshNotificationCaches: RefreshNotificationCaches;
  ventaId: string;
}) {
  await useVentasStore.getState().updateVenta(ventaId, {
    estado: 'inactivo',
    cortadaAt: new Date(),
    motivoCorte,
  });

  await useNotificacionesStore.getState().deleteNotificacionesPorVenta(ventaId);
  await refreshNotificationCaches();

  invalidateDashboardCache({
    entity: 'venta',
    entityId: ventaId,
  });

  toast.success('Venta cortada exitosamente');
  void useVentasStore.getState().fetchVentas(true);
}

export async function inactivateServicioFromNotificationUseCase({
  refreshNotificationCaches,
  servicioId,
  servicioNombre,
}: {
  refreshNotificationCaches: RefreshNotificationCaches;
  servicioId: string;
  servicioNombre: string;
}) {
  await useServiciosStore.getState().updateServicio(servicioId, { activo: false });
  await useNotificacionesStore.getState().deleteNotificacionesPorServicio(servicioId);
  toast.success('Servicio inactivado', {
    description: `${servicioNombre} ha sido marcado como inactivo.`,
  });
  await refreshNotificationCaches();
}
