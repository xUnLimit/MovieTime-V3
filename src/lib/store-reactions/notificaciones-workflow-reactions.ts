import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import { useServiciosStore } from '@/store/serviciosStore';
import { useVentasStore } from '@/store/ventasStore';
import type { MetodoPago } from '@/types';

export async function cutVentaFromNotificationStoreWorkflow(ventaId: string, motivoCorte: string) {
  await useVentasStore.getState().updateVenta(ventaId, {
    estado: 'inactivo',
    cortadaAt: new Date(),
    motivoCorte,
  });
  await useNotificacionesStore.getState().deleteNotificacionesPorVenta(ventaId);
}

export async function inactivateServicioFromNotificationStoreWorkflow(servicioId: string) {
  await useServiciosStore.getState().updateServicio(servicioId, { activo: false });
  await useNotificacionesStore.getState().deleteNotificacionesPorServicio(servicioId);
}

export async function activateReposoServicioStoreWorkflow(
  servicioId: string,
  updates: Parameters<ReturnType<typeof useServiciosStore.getState>['updateServicio']>[1],
) {
  await useServiciosStore.getState().updateServicio(servicioId, updates);
}

export async function deleteReposoServicioStoreWorkflow(servicioId: string, deletePayments: boolean) {
  await useServiciosStore.getState().deleteServicio(servicioId, deletePayments);
}

export async function deleteNotificationStoreItem(notificationId: string) {
  await useNotificacionesStore.getState().deleteNotificacion(notificationId);
}

export function refreshVentasStoreCache() {
  void useVentasStore.getState().fetchVentas(true);
}

export function getCurrentMetodosPagoStoreSnapshot(): MetodoPago[] {
  return useMetodosPagoStore.getState().metodosPago;
}

export async function deleteVentaNotificationsStoreWorkflow(ventaId: string) {
  await useNotificacionesStore.getState().deleteNotificacionesPorVenta(ventaId);
}

export async function deleteServicioNotificationsStoreWorkflow(servicioId: string) {
  await useNotificacionesStore.getState().deleteNotificacionesPorServicio(servicioId);
}
