import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ refreshCategorias: vi.fn() }));
vi.mock('@/platform/commands/client-cache', () => ({ refreshCategoriasCache: mocks.refreshCategorias }));

import {
  emitTerceroMetodoPagoUpdated,
  emitVentaUpdated,
  invalidateVentasPorTercerosCache,
  subscribeToCategoriaListReactions,
  subscribeToServicioCategoryListReactions,
  subscribeToServicioListReactions,
  subscribeToTerceroDetailReactions,
  subscribeToTercerosPageReactions,
  subscribeToVentaListReactions,
  subscribeToVentasPorTercerosReactions,
  subscribeToVentasTerceroReactions,
} from './cache-reactions';
import { storeEventBus } from './store-event-bus';

function client() {
  return { invalidateQueries: vi.fn().mockResolvedValue(undefined) } as unknown as QueryClient;
}

beforeEach(() => {
  storeEventBus.clear();
  vi.clearAllMocks();
});
afterEach(() => storeEventBus.clear());

describe('cache reactions', () => {
  it('refreshes venta lists for names and venta mutations, then unsubscribes', () => {
    const queryClient = client();
    const refresh = vi.fn();
    const unsubscribe = subscribeToVentaListReactions(queryClient, refresh);
    storeEventBus.emit({ type: 'TERCERO_NOMBRE_UPDATED', terceroId: 't1' });
    storeEventBus.emit({ type: 'VENTA_CREATED', ventaId: 'v1' });
    storeEventBus.emit({ type: 'VENTA_UPDATED', ventaId: 'v1' });
    storeEventBus.emit({ type: 'VENTA_DELETED', ventaId: 'v1' });
    expect(refresh).toHaveBeenCalledTimes(4);
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3);
    unsubscribe();
    storeEventBus.emit({ type: 'VENTA_CREATED', ventaId: 'v2' });
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it('invalidates ventas by tercero for all dependent events', () => {
    const queryClient = client();
    const unsubscribe = subscribeToVentasTerceroReactions(queryClient, ['custom']);
    storeEventBus.emit({ type: 'VENTA_CREATED', ventaId: 'v1' });
    storeEventBus.emit({ type: 'VENTA_UPDATED', ventaId: 'v1' });
    storeEventBus.emit({ type: 'VENTA_DELETED', ventaId: 'v1' });
    storeEventBus.emit({ type: 'SERVICIO_UPDATED', servicioId: 's1' });
    storeEventBus.emit({ type: 'SERVICIOS_INVALIDATED' });
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(5);
    unsubscribe();
  });

  it('tracks and removes aggregate listeners', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToVentasPorTercerosReactions(listener);
    invalidateVentasPorTercerosCache();
    storeEventBus.emit({ type: 'VENTA_CREATED', ventaId: 'v1' });
    storeEventBus.emit({ type: 'VENTA_UPDATED', ventaId: 'v1' });
    storeEventBus.emit({ type: 'VENTA_DELETED', ventaId: 'v1' });
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
    invalidateVentasPorTercerosCache();
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('emits update helpers', () => {
    const venta = vi.fn();
    const tercero = vi.fn();
    storeEventBus.on('VENTA_UPDATED', venta);
    storeEventBus.on('TERCERO_METODO_PAGO_UPDATED', tercero);
    emitVentaUpdated('v1');
    emitTerceroMetodoPagoUpdated('t1');
    expect(venta).toHaveBeenCalledWith({ type: 'VENTA_UPDATED', ventaId: 'v1' });
    expect(tercero).toHaveBeenCalledWith({ type: 'TERCERO_METODO_PAGO_UPDATED', terceroId: 't1' });
  });

  it('refreshes service and category lists', () => {
    const queryClient = client();
    const refresh = vi.fn();
    const categoryRefresh = vi.fn();
    const refetch = vi.fn().mockResolvedValue(undefined);
    subscribeToServicioListReactions(queryClient, refresh);
    subscribeToServicioCategoryListReactions(categoryRefresh);
    subscribeToCategoriaListReactions(queryClient, refetch);
    storeEventBus.emit({ type: 'SERVICIO_DELETED', servicioId: 's1' });
    storeEventBus.emit({ type: 'CATEGORIA_DELETED', categoriaId: 'c1' });
    expect(mocks.refreshCategorias).toHaveBeenCalledWith({ entity: 'servicio' });
    expect(refresh).toHaveBeenCalled();
    expect(categoryRefresh).toHaveBeenCalled();
    expect(refetch).toHaveBeenCalled();
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(4);
  });

  it('filters detail reactions and coordinates terceros page reactions', () => {
    const queryClient = client();
    const refresh = vi.fn();
    const refetch = vi.fn().mockResolvedValue(undefined);
    const aggregate = vi.fn();
    const stopAggregate = subscribeToVentasPorTercerosReactions(aggregate);
    subscribeToTerceroDetailReactions(queryClient, 'target');
    const unsubscribe = subscribeToTercerosPageReactions({
      queryClient, refresh, refetchMetodoPagoOptions: refetch,
    });
    storeEventBus.emit({ type: 'TERCERO_METODO_PAGO_UPDATED', terceroId: 'other' });
    storeEventBus.emit({ type: 'TERCERO_METODO_PAGO_UPDATED', terceroId: 'target' });
    storeEventBus.emit({ type: 'TERCERO_DELETED', terceroId: 'target' });
    storeEventBus.emit({ type: 'VENTA_DELETED', ventaId: 'v1' });
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3);
    expect(refresh).toHaveBeenCalledTimes(4);
    expect(refetch).toHaveBeenCalledTimes(2);
    expect(aggregate).toHaveBeenCalledTimes(2);
    unsubscribe();
    stopAggregate();
  });
});
