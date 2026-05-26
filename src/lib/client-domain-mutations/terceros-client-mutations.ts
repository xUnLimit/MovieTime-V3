import {
  afterTerceroDeleted,
  afterTerceroUpdated,
} from '@/lib/store-reactions/terceros-mutation-reactions';
import {
  createTerceroUseCase,
  deleteTerceroUseCase,
  getTerceroUseCase,
  resolveTerceroForDelete,
  updateTerceroUseCase,
} from '@/lib/use-cases/terceros-use-cases';
import { getActivityLogOptions } from '@/lib/activity/activity-log-writer';
import { invalidateStoreQueries } from '@/lib/cache/store-query-invalidation';
import type { Tercero } from '@/types';

export async function createTerceroMutation(usuario: Omit<Tercero, 'id' | 'createdAt' | 'updatedAt' | 'serviciosActivos'>) {
  await createTerceroUseCase(usuario, getActivityLogOptions());
  await invalidateStoreQueries(['terceros', 'ventas', 'notificaciones', 'pagination']);
}

export async function updateTerceroMutation(id: string, updates: Partial<Tercero>, oldTercero?: Tercero) {
  const resolvedOldTercero = oldTercero ?? await getTerceroUseCase<Tercero>(id) ?? undefined;
  const {
    shouldRefreshNotificaciones,
    shouldDispatchTerceroNombreUpdated,
  } = await updateTerceroUseCase(id, updates, {
    oldTercero: resolvedOldTercero,
    ...getActivityLogOptions(),
  });

  await afterTerceroUpdated({
    terceroId: id,
    shouldRefreshNotificaciones,
    shouldDispatchTerceroNombreUpdated,
  });
  await invalidateStoreQueries(['terceros', 'ventas', 'notificaciones', 'pagination']);
}

export async function deleteTerceroMutation(
  id: string,
  usuarioData?: { tipo: 'cliente' | 'revendedor'; nombre?: string; createdAt?: Date; serviciosActivos?: number },
  localTercero?: Tercero,
) {
  const deletedUser = await resolveTerceroForDelete(id, usuarioData, localTercero);
  await deleteTerceroUseCase(id, deletedUser, getActivityLogOptions());
  await afterTerceroDeleted(id);
  await invalidateStoreQueries(['terceros', 'ventas', 'notificaciones', 'pagination']);
}
