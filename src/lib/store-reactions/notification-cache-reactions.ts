import { useNotificacionesStore } from '@/store/notificacionesStore';

export async function refreshNotificationListCache() {
  await useNotificacionesStore.getState().fetchNotificaciones(true);
}

export async function refreshNotificationStoreCache() {
  await Promise.all([
    refreshNotificationListCache(),
    useNotificacionesStore.getState().fetchCounts(),
  ]);
}

export async function deleteVentaNotificationStoreCache(ventaId: string) {
  await useNotificacionesStore.getState().deleteNotificacionesPorVenta(ventaId);
}

export async function deleteServicioNotificationStoreCache(servicioId: string) {
  await useNotificacionesStore.getState().deleteNotificacionesPorServicio(servicioId);
}
