import { useServiciosStore } from '@/store/serviciosStore';
import { useVentasStore } from '@/store/ventasStore';

export async function deleteVentaDetailStoreWorkflow({
  deletePagos,
  perfilNumero,
  servicioId,
  ventaId,
}: {
  deletePagos: boolean;
  perfilNumero?: number | null;
  servicioId?: string | null;
  ventaId: string;
}) {
  await useVentasStore
    .getState()
    .deleteVenta(ventaId, servicioId ?? undefined, perfilNumero ?? undefined, deletePagos);
}

export async function updateServicioPerfilOcupadoWorkflow({
  servicioId,
  shouldIncrement,
}: {
  servicioId: string;
  shouldIncrement: boolean;
}) {
  await useServiciosStore.getState().updatePerfilOcupado(servicioId, shouldIncrement);
}
