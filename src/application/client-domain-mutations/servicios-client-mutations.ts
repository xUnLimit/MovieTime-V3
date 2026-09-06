import {
  afterServicioCreated,
  afterServicioDeleted,
  afterServicioUpdated,
} from '@/application/store-reactions/servicios-mutation-reactions';
import {
  createServicioUseCase,
  deleteServicioUseCase,
  updateServicioUseCase,
} from '@/application/use-cases/servicios/servicios-write-use-cases';
import { getActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import type { Servicio } from '@/types';
import { afterCommit } from '@/platform/errors/mutation-committed-error';

export async function createServicioMutation(servicio: Omit<Servicio, 'id' | 'createdAt' | 'updatedAt' | 'perfilesOcupados'>, idempotencyKey?: string) {
  const { servicio: created } = await createServicioUseCase(servicio, { ...getActivityLogOptions(), idempotencyKey });
  return afterCommit(created.id, async () => {
    await afterServicioCreated(created.id);
    await invalidateStoreQueries(['servicios', 'categorias', 'ventas', 'pagination']);
  });
}

export async function updateServicioMutation(id: string, updates: Partial<Servicio>) {
  await updateServicioUseCase(id, updates, getActivityLogOptions());
  await afterServicioUpdated(id);
  await invalidateStoreQueries(['servicios', 'categorias', 'ventas', 'pagination']);
}

export async function deleteServicioMutation(id: string, deletePayments = false) {
  await deleteServicioUseCase(id, {
    deletePayments,
    ...getActivityLogOptions(),
  });
  await afterServicioDeleted(id);
  await invalidateStoreQueries(['servicios', 'categorias', 'ventas', 'pagination']);
}

export async function refreshServicioProfileCountMutation() {
  await invalidateStoreQueries(['servicios', 'ventas', 'pagination']);
}
