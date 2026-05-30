import {
  afterVentaCreated,
  afterVentaDeleted,
  afterVentaUpdated,
} from '@/lib/store-reactions/ventas-mutation-reactions';
import {
  createVentaUseCase,
  deleteVentaUseCase,
  updateVentaUseCase,
} from '@/lib/use-cases/ventas/ventas-write-use-cases';
import { getActivityLogOptions } from '@/lib/activity/activity-log-writer';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import type { VentaDoc } from '@/types';

export async function createVentaMutation(venta: Omit<VentaDoc, 'id' | 'createdAt' | 'updatedAt'>) {
  const { venta: created } = await createVentaUseCase(venta, getActivityLogOptions());
  await afterVentaCreated(created.id);
  await invalidateStoreQueries(['ventas', 'servicios', 'terceros', 'pagination']);
}

export async function updateVentaMutation(id: string, updates: Partial<VentaDoc>) {
  const { serviceProfileDelta } = await updateVentaUseCase(id, updates, getActivityLogOptions());
  await afterVentaUpdated(id, serviceProfileDelta);
  await invalidateStoreQueries(['ventas', 'servicios', 'terceros', 'pagination']);
}

export async function deleteVentaMutation(id: string, servicioId?: string, perfilNumero?: number | null, deletePagos = false) {
  const { serviceProfileDelta } = await deleteVentaUseCase(id, {
    servicioId,
    perfilNumero,
    deletePagos,
    ...getActivityLogOptions(),
  });
  await afterVentaDeleted(id, serviceProfileDelta);
  await invalidateStoreQueries(['ventas', 'servicios', 'terceros', 'notificaciones', 'pagination']);
}
