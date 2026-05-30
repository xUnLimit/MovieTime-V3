import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import {
  deleteNotificacionesPorServicioUseCase,
  deleteNotificacionesPorVentaUseCase,
  fetchNotificationCountsUseCase,
  toggleNotificacionLeidaUseCase,
  toggleNotificacionResaltadaUseCase,
} from '@/application/use-cases/notificaciones/notificaciones-store-use-cases';

export async function refreshNotificationListCache() {
  await invalidateStoreQueries(['notificaciones', 'dashboard']);
}

export async function refreshNotificationStoreCache() {
  await Promise.all([
    refreshNotificationListCache(),
    fetchNotificationCountsUseCase(),
  ]);
  await invalidateStoreQueries(['notificaciones']);
}

export async function deleteVentaNotificationStoreCache(ventaId: string) {
  await deleteNotificacionesPorVentaUseCase(ventaId);
  await refreshNotificationListCache();
}

export async function deleteServicioNotificationStoreCache(servicioId: string) {
  await deleteNotificacionesPorServicioUseCase(servicioId);
  await refreshNotificationListCache();
}

export async function toggleNotificationReadStoreCache(notificationId: string, read: boolean) {
  await toggleNotificacionLeidaUseCase(notificationId, read);
  await refreshNotificationListCache();
}

export async function toggleNotificationHighlightedStoreCache(notificationId: string, highlighted: boolean) {
  await toggleNotificacionResaltadaUseCase(notificationId, highlighted);
  await refreshNotificationListCache();
}
