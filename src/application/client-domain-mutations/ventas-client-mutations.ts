import { createVentasFromCartUseCase } from '@/application/use-cases/ventas/create-ventas-from-cart-use-case';
import { reportError } from '@/platform/observability/logger';
import {
  afterVentaCreated,
  afterVentaDeleted,
  afterVentaUpdated,
} from '@/application/store-reactions/ventas-mutation-reactions';
import {
  createVentaUseCase,
  deleteVentaUseCase,
  updateVentaUseCase,
} from '@/application/use-cases/ventas/ventas-write-use-cases';
import { getActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import type { VentaDoc } from '@/types';
import { afterCommit } from '@/platform/errors/mutation-committed-error';

export async function createVentaMutation(venta: Omit<VentaDoc, 'id' | 'createdAt' | 'updatedAt'>, idempotencyKey?: string) {
  const { venta: created } = await createVentaUseCase(venta, { ...getActivityLogOptions(), idempotencyKey });
  return afterCommit(created.id, async () => {
    await afterVentaCreated(created.id);
    await invalidateStoreQueries(['ventas', 'servicios', 'terceros', 'pagination']);
    return created.id;
  });
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

export async function createVentasFromCartMutation(
  ventas: Parameters<typeof createVentasFromCartUseCase>[0],
  options: Pick<Parameters<typeof createVentasFromCartUseCase>[1], 'idempotencyKey' | 'session'>,
) {
  const result = await createVentasFromCartUseCase(ventas, { ...getActivityLogOptions(), ...options });
  try {
    for (const ventaId of result.ventaIds) await afterVentaCreated(ventaId);
    await invalidateStoreQueries(['ventas', 'servicios', 'terceros', 'notificaciones', 'pagination']);
  } catch (error) {
    reportError('CreateVentasFromCart', 'Error actualizando datos del pedido confirmado', error);
    result.warnings.push('No se pudieron actualizar los datos de la pantalla.');
  }
  return result;
}
