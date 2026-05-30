import { safeAsyncSideEffect } from '@/platform/utils/safety';
import { getActiveQueryClient } from '@/platform/query-client-registry';
import { queryKeys } from '@/platform/query-keys';
import { storeEventBus } from '@/platform/events/store-event-bus';

type CacheContext = {
  entity?: string;
  entityId?: string | null;
};

export function invalidateDashboardCache(context: CacheContext = {}) {
  storeEventBus.emit({ type: 'DASHBOARD_INVALIDATED' });
  safeAsyncSideEffect(Promise.resolve().then(() => {
    return getActiveQueryClient()?.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  }), {
    operation: 'invalidateDashboardCache',
    entity: context.entity,
    entityId: context.entityId,
  });
}

export function refreshCategoriasCache(context: CacheContext = {}) {
  storeEventBus.emit({ type: 'CATEGORIAS_INVALIDATED' });
  safeAsyncSideEffect(Promise.resolve().then(() => {
    return getActiveQueryClient()?.invalidateQueries({ queryKey: queryKeys.categorias.all });
  }), {
    operation: 'refreshCategorias',
    entity: context.entity,
    entityId: context.entityId,
  });
}
