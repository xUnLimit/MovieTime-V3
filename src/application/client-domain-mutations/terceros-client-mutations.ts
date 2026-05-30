import {
  afterTerceroUpdated,
} from '@/application/store-reactions/terceros-mutation-reactions';
import {
  createTerceroUseCase,
  deleteTerceroUseCase,
  getTerceroUseCase,
  resolveTerceroForDelete,
  updateTerceroUseCase,
} from '@/application/use-cases/terceros-use-cases';
import { getActivityLogOptions } from '@/application/activity/activity-log-writer';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
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
  // deleteTerceroUseCase emite TERCERO_DELETED (unico emisor del hecho de dominio).
  await deleteTerceroUseCase(id, deletedUser, getActivityLogOptions());
  await invalidateStoreQueries(['terceros', 'ventas', 'notificaciones', 'pagination']);
}
