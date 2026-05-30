import {
  afterServicioCreated,
  afterServicioDeleted,
  afterServicioUpdated,
} from '@/lib/store-reactions/servicios-mutation-reactions';
import {
  createServicioUseCase,
  deleteServicioUseCase,
  updateServicioUseCase,
} from '@/lib/use-cases/servicios/servicios-write-use-cases';
import { getActivityLogOptions } from '@/lib/activity/activity-log-writer';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import type { Servicio } from '@/types';

export async function createServicioMutation(servicio: Omit<Servicio, 'id' | 'createdAt' | 'updatedAt' | 'perfilesOcupados'>) {
  const { servicio: created } = await createServicioUseCase(servicio, getActivityLogOptions());
  await afterServicioCreated(created.id);
  await invalidateStoreQueries(['servicios', 'categorias', 'ventas', 'pagination']);
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
