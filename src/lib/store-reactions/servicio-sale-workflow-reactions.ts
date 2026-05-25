import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useServiciosStore } from '@/store/serviciosStore';
import { useTercerosStore } from '@/store/tercerosStore';

export async function updateServicioSaleProfileWorkflow(servicioId: string, shouldIncrement: boolean) {
  await useServiciosStore.getState().updatePerfilOcupado(servicioId, shouldIncrement);
}

export async function deleteVentaSaleNotificationsWorkflow(ventaId: string) {
  await useNotificacionesStore.getState().deleteNotificacionesPorVenta(ventaId);
}

export function getTerceroForServicioSaleWorkflow(terceroId?: string | null) {
  if (!terceroId) return undefined;
  return useTercerosStore.getState().terceros.find((item) => item.id === terceroId);
}
