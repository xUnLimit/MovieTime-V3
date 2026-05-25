import { safeAsyncSideEffect } from '@/lib/utils/safety';
import { getActiveQueryClient } from '@/lib/query-client-registry';
import { queryKeys } from '@/lib/query-keys';
import { storeEventBus } from '@/lib/events/store-event-bus';
import { refreshCategoriasStoreCache } from '@/lib/store-reactions/categorias-cache-reactions';

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
    void getActiveQueryClient()?.invalidateQueries({ queryKey: queryKeys.categorias.all });
    return refreshCategoriasStoreCache();
  }), {
    operation: 'refreshCategorias',
    entity: context.entity,
    entityId: context.entityId,
  });
}
