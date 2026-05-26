import { getActiveQueryClient } from '@/lib/query-client-registry';
import { queryKeys } from '@/lib/query-keys';
import { invalidateStoreQueries } from '@/lib/cache/store-query-invalidation';
import { getActivityLogOptions } from '@/lib/activity/activity-log-writer';
import {
  deleteNotificacionUseCase,
  deleteNotificacionesPorServicioUseCase,
  deleteNotificacionesPorVentaUseCase,
} from '@/lib/use-cases/notificaciones/notificaciones-store-use-cases';
import {
  deleteServicioUseCase,
  updateServicioUseCase,
} from '@/lib/use-cases/servicios/servicios-write-use-cases';
import { updateVentaUseCase } from '@/lib/use-cases/ventas/ventas-write-use-cases';
import type { Servicio } from '@/types';
import type { MetodoPago } from '@/types';

export async function cutVentaFromNotificationStoreWorkflow(ventaId: string, motivoCorte: string) {
  await updateVentaUseCase(ventaId, {
      estado: 'inactivo',
      cortadaAt: new Date(),
      motivoCorte,
    },
    getActivityLogOptions(),
  );
  await deleteNotificacionesPorVentaUseCase(ventaId);
  await invalidateStoreQueries(['ventas', 'notificaciones', 'dashboard', 'pagination']);
}

export async function inactivateServicioFromNotificationStoreWorkflow(servicioId: string) {
  await updateServicioUseCase(servicioId, { activo: false }, getActivityLogOptions());
  await deleteNotificacionesPorServicioUseCase(servicioId);
  await invalidateStoreQueries(['servicios', 'notificaciones', 'dashboard', 'pagination']);
}

export async function activateReposoServicioStoreWorkflow(
  servicioId: string,
  updates: Partial<Servicio>,
) {
  await updateServicioUseCase(servicioId, updates, getActivityLogOptions());
  await invalidateStoreQueries(['servicios', 'dashboard', 'pagination']);
}

export async function deleteReposoServicioStoreWorkflow(servicioId: string, deletePayments: boolean) {
  await deleteServicioUseCase(servicioId, {
    deletePayments,
    ...getActivityLogOptions(),
  });
  await invalidateStoreQueries(['servicios', 'categorias', 'ventas', 'notificaciones', 'dashboard', 'pagination']);
}

export async function deleteNotificationStoreItem(notificationId: string) {
  await deleteNotificacionUseCase(notificationId);
  await invalidateStoreQueries(['notificaciones', 'dashboard']);
}

export function refreshVentasStoreCache() {
  const queryClient = getActiveQueryClient();
  void queryClient?.invalidateQueries({ queryKey: queryKeys.ventas.all });
  void queryClient?.invalidateQueries({ queryKey: queryKeys.pagination.all });
}

export function getCurrentMetodosPagoStoreSnapshot(): MetodoPago[] {
  const queryClient = getActiveQueryClient();
  if (!queryClient) return [];

  return queryClient
    .getQueriesData<unknown>({ queryKey: queryKeys.metodosPago.all })
    .flatMap(([, data]) => (Array.isArray(data) ? data as MetodoPago[] : []));
}

export async function deleteVentaNotificationsStoreWorkflow(ventaId: string) {
  await deleteNotificacionesPorVentaUseCase(ventaId);
  await invalidateStoreQueries(['notificaciones', 'dashboard']);
}

export async function deleteServicioNotificationsStoreWorkflow(servicioId: string) {
  await deleteNotificacionesPorServicioUseCase(servicioId);
  await invalidateStoreQueries(['notificaciones', 'dashboard']);
}
