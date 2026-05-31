import { getActiveQueryClient } from '@/platform/query-client-registry';
import { queryKeys } from '@/platform/query-keys';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import type { ActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import {
  deleteNotificacionUseCase,
  deleteNotificacionesPorServicioUseCase,
  deleteNotificacionesPorVentaUseCase,
} from '@/application/use-cases/notificaciones/notificaciones-store-use-cases';
import {
  deleteServicioUseCase,
  updateServicioUseCase,
} from '@/application/use-cases/servicios/servicios-write-use-cases';
import { updateVentaUseCase } from '@/application/use-cases/ventas/ventas-write-use-cases';
import type { Servicio } from '@/types';
import type { MetodoPago } from '@/types';

// NOTE: el contexto de log (identidad del usuario) se INYECTA por parametro (log).
// Estos workflows no leen el store de auth/activity; el caller (composition root en UI)
// pasa getActivityLogOptions(). Esto mantiene la capa de aplicacion libre de Zustand.
export async function cutVentaFromNotificationStoreWorkflow(
  ventaId: string,
  motivoCorte: string,
  log: ActivityLogOptions,
) {
  await updateVentaUseCase(ventaId, {
      estado: 'inactivo',
      cortadaAt: new Date(),
      motivoCorte,
    },
    log,
  );
  await deleteNotificacionesPorVentaUseCase(ventaId);
  await invalidateStoreQueries(['ventas', 'notificaciones', 'dashboard', 'pagination']);
}

export async function inactivateServicioFromNotificationStoreWorkflow(
  servicioId: string,
  log: ActivityLogOptions,
) {
  await updateServicioUseCase(servicioId, { activo: false }, log);
  await deleteNotificacionesPorServicioUseCase(servicioId);
  await invalidateStoreQueries(['servicios', 'notificaciones', 'dashboard', 'pagination']);
}

export async function activateReposoServicioStoreWorkflow(
  servicioId: string,
  updates: Partial<Servicio>,
  log: ActivityLogOptions,
) {
  await updateServicioUseCase(servicioId, updates, log);
  await invalidateStoreQueries(['servicios', 'dashboard', 'pagination']);
}

export async function deleteReposoServicioStoreWorkflow(
  servicioId: string,
  deletePayments: boolean,
  log: ActivityLogOptions,
) {
  await deleteServicioUseCase(servicioId, {
    deletePayments,
    ...log,
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
