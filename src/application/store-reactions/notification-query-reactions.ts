import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/platform/query-keys';

type CacheInvalidation = {
  entity: 'venta' | 'servicio';
  entityId: string;
};

type QueryTarget = 'categorias' | 'servicios' | 'notificaciones' | 'ventas';

type NotificationQueryReactionInput = {
  cacheInvalidations?: CacheInvalidation[];
  notificationInvalidationNeeded?: boolean;
  queryTargets?: QueryTarget[];
  storeRefreshes?: QueryTarget[];
};

export async function applyNotificationQueryReactions(
  queryClient: QueryClient,
  outcome: NotificationQueryReactionInput,
) {
  const targets = new Set<QueryTarget>([
    ...(outcome.queryTargets ?? []),
    ...(outcome.storeRefreshes ?? []),
  ]);

  if (outcome.notificationInvalidationNeeded) {
    targets.add('notificaciones');
  }

  await Promise.all([
    ...Array.from(targets).map((target) => invalidateTarget(queryClient, target)),
    ...(outcome.cacheInvalidations ?? []).flatMap((invalidation) =>
      invalidateEntity(queryClient, invalidation),
    ),
  ]);
}

function invalidateTarget(queryClient: QueryClient, target: QueryTarget) {
  switch (target) {
    case 'categorias':
      return queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all });
    case 'servicios':
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.servicios.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.servicios.reposo() }),
      ]);
    case 'ventas':
      return queryClient.invalidateQueries({ queryKey: queryKeys.ventas.all });
    case 'notificaciones':
      return queryClient.invalidateQueries({ queryKey: queryKeys.notificaciones.all });
  }
}

function invalidateEntity(queryClient: QueryClient, invalidation: CacheInvalidation) {
  if (invalidation.entity === 'venta') {
    return [
      queryClient.invalidateQueries({ queryKey: queryKeys.ventas.detail(invalidation.entityId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    ];
  }

  return [
    queryClient.invalidateQueries({ queryKey: queryKeys.servicios.detail(invalidation.entityId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
  ];
}
