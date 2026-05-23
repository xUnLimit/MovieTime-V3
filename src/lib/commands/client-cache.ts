import { safeAsyncSideEffect } from '@/lib/utils/safety';
import { useCategoriasStore } from '@/store/categoriasStore';
import { getActiveQueryClient } from '@/lib/query-client-registry';
import { queryKeys } from '@/lib/query-keys';

type CacheContext = {
  entity?: string;
  entityId?: string | null;
};

export function invalidateDashboardCache(context: CacheContext = {}) {
  safeAsyncSideEffect(Promise.resolve().then(() => {
    return getActiveQueryClient()?.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  }), {
    operation: 'invalidateDashboardCache',
    entity: context.entity,
    entityId: context.entityId,
  });
}

export function refreshCategoriasCache(context: CacheContext = {}) {
  safeAsyncSideEffect(Promise.resolve().then(() => {
    useCategoriasStore.getState().fetchCategorias(true);
  }), {
    operation: 'refreshCategorias',
    entity: context.entity,
    entityId: context.entityId,
  });
}

export function syncVentaPronosticoLocal(ventaId: string, pronostico?: unknown) {
  void pronostico;

  safeAsyncSideEffect(Promise.resolve().then(() => {
    return getActiveQueryClient()?.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  }), {
    operation: 'syncVentaPronosticoLocal',
    entity: 'venta',
    entityId: ventaId,
  });
}

export function syncServicioPronosticoLocal(
  servicioId: string,
  pronostico: unknown
) {
  if (pronostico === undefined) return;

  safeAsyncSideEffect(Promise.resolve().then(() => {
    return getActiveQueryClient()?.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  }), {
    operation: 'syncServicioPronosticoLocal',
    entity: 'servicio',
    entityId: servicioId,
  });
}
