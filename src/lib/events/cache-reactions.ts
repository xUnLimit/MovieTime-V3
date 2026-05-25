import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { refreshCategoriasCache } from '@/lib/commands/client-cache';
import { storeEventBus } from '@/lib/events/store-event-bus';
import { queryKeys } from '@/lib/query-keys';

type RefreshHandler = () => void;
type AsyncRefreshHandler = () => Promise<unknown>;

const ventasPorTercerosInvalidationListeners = new Set<RefreshHandler>();

function combineUnsubscribers(unsubscribers: Array<() => void>) {
  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

function invalidateQuery(queryClient: QueryClient, queryKey: QueryKey) {
  void queryClient.invalidateQueries({ queryKey });
}

export function subscribeToVentaListReactions(
  queryClient: QueryClient,
  refresh: RefreshHandler,
) {
  const refreshVentas = () => {
    refresh();
    void queryClient.invalidateQueries({ queryKey: queryKeys.ventas.counts() });
  };

  return combineUnsubscribers([
    storeEventBus.on('TERCERO_NOMBRE_UPDATED', refresh),
    storeEventBus.on('VENTA_CREATED', refreshVentas),
    storeEventBus.on('VENTA_UPDATED', refreshVentas),
    storeEventBus.on('VENTA_DELETED', refreshVentas),
  ]);
}

export function subscribeToVentasTerceroReactions(
  queryClient: QueryClient,
  queryKey: QueryKey,
) {
  const invalidate = () => invalidateQuery(queryClient, queryKey);

  return combineUnsubscribers([
    storeEventBus.on('VENTA_CREATED', invalidate),
    storeEventBus.on('VENTA_UPDATED', invalidate),
    storeEventBus.on('VENTA_DELETED', invalidate),
    storeEventBus.on('SERVICIO_UPDATED', invalidate),
    storeEventBus.on('SERVICIOS_INVALIDATED', invalidate),
  ]);
}

export function subscribeToVentasPorTercerosReactions(invalidate: RefreshHandler) {
  ventasPorTercerosInvalidationListeners.add(invalidate);

  const unsubscribeEvents = combineUnsubscribers([
    storeEventBus.on('VENTA_CREATED', invalidate),
    storeEventBus.on('VENTA_UPDATED', invalidate),
    storeEventBus.on('VENTA_DELETED', invalidate),
  ]);

  return () => {
    ventasPorTercerosInvalidationListeners.delete(invalidate);
    unsubscribeEvents();
  };
}

export function invalidateVentasPorTercerosCache() {
  ventasPorTercerosInvalidationListeners.forEach((listener) => listener());
}

export function emitVentaUpdated(ventaId: string) {
  storeEventBus.emit({ type: 'VENTA_UPDATED', ventaId });
}

export function emitTerceroMetodoPagoUpdated(terceroId: string) {
  storeEventBus.emit({ type: 'TERCERO_METODO_PAGO_UPDATED', terceroId });
}

export function subscribeToServicioListReactions(
  queryClient: QueryClient,
  refresh: RefreshHandler,
) {
  const refreshServicios = () => {
    refreshCategoriasCache({ entity: 'servicio' });
    void queryClient.invalidateQueries({ queryKey: queryKeys.categorias.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.servicios.counts() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ventas.counts() });
    refresh();
  };

  return storeEventBus.on('SERVICIO_DELETED', refreshServicios);
}

export function subscribeToServicioCategoryListReactions(refresh: RefreshHandler) {
  return storeEventBus.on('SERVICIO_DELETED', refresh);
}

export function subscribeToCategoriaListReactions(
  queryClient: QueryClient,
  refetchCategorias: AsyncRefreshHandler,
) {
  const refreshCategorias = () => {
    void refetchCategorias();
    invalidateQuery(queryClient, queryKeys.categorias.counts());
  };

  return storeEventBus.on('CATEGORIA_DELETED', refreshCategorias);
}

export function subscribeToTerceroDetailReactions(
  queryClient: QueryClient,
  terceroId: string,
) {
  return storeEventBus.on('TERCERO_METODO_PAGO_UPDATED', (event) => {
    if (event.terceroId !== terceroId) return;

    invalidateQuery(queryClient, queryKeys.terceros.detail(terceroId));
  });
}

export function subscribeToTercerosPageReactions({
  queryClient,
  refresh,
  refetchMetodoPagoOptions,
}: {
  queryClient: QueryClient;
  refresh: RefreshHandler;
  refetchMetodoPagoOptions: AsyncRefreshHandler;
}) {
  const handleVentaDeleted = () => {
    invalidateVentasPorTercerosCache();
    refresh();
  };

  const handleTerceroDeleted = () => {
    refresh();
    invalidateQuery(queryClient, queryKeys.terceros.lists());
    invalidateQuery(queryClient, queryKeys.terceros.counts());
  };

  const handleTerceroMetodoPagoUpdated = () => {
    refresh();
    void refetchMetodoPagoOptions();
  };

  return combineUnsubscribers([
    storeEventBus.on('VENTA_DELETED', handleVentaDeleted),
    storeEventBus.on('TERCERO_DELETED', handleTerceroDeleted),
    storeEventBus.on('TERCERO_METODO_PAGO_UPDATED', handleTerceroMetodoPagoUpdated),
  ]);
}
