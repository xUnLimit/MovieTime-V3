import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createVentaMutation,
  deleteCategoriaMutation,
  updateServicioMutation,
} from '@/lib/client-domain-mutations';
import { storeEventBus, type StoreEvent } from '@/lib/events/store-event-bus';
import { queryKeys } from '@/lib/query-keys';
import { registerActiveQueryClient } from '@/lib/query-client-registry';
import { applyNotificationQueryReactions } from '@/lib/store-reactions/notification-query-reactions';
import { cutVentaFromNotificationUseCase } from '@/lib/use-cases/notificaciones/notificaciones-actions-use-cases';

const mocks = vi.hoisted(() => ({
  createVentaUseCase: vi.fn(),
  updateServicioUseCase: vi.fn(),
  deleteCategoriaUseCase: vi.fn(),
  getActivityLogOptions: vi.fn(),
  syncVentaForecastReadModels: vi.fn(),
  syncServicioForecastReadModels: vi.fn(),
  cutVentaFromNotificationStoreWorkflow: vi.fn(),
  refreshVentasStoreCache: vi.fn(),
}));

vi.mock('@/lib/activity/activity-log-writer', () => ({
  getActivityLogOptions: mocks.getActivityLogOptions,
}));

vi.mock('@/lib/forecasting', () => ({
  syncServicioForecastReadModels: mocks.syncServicioForecastReadModels,
  syncVentaForecastReadModels: mocks.syncVentaForecastReadModels,
}));

vi.mock('@/lib/use-cases/ventas/ventas-write-use-cases', () => ({
  createVentaUseCase: mocks.createVentaUseCase,
}));

vi.mock('@/lib/use-cases/servicios/servicios-write-use-cases', () => ({
  updateServicioUseCase: mocks.updateServicioUseCase,
}));

vi.mock('@/lib/use-cases/categorias-use-cases', () => ({
  deleteCategoriaUseCase: mocks.deleteCategoriaUseCase,
}));

vi.mock('@/lib/store-reactions/notificaciones-workflow-reactions', () => ({
  cutVentaFromNotificationStoreWorkflow: mocks.cutVentaFromNotificationStoreWorkflow,
  inactivateServicioFromNotificationStoreWorkflow: vi.fn(),
  refreshVentasStoreCache: mocks.refreshVentasStoreCache,
}));

describe('client domain mutation contract', () => {
  let queryClient: QueryClient;
  let unregisterQueryClient: () => void;
  let invalidateQueries: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    storeEventBus.clear();
    queryClient = new QueryClient();
    unregisterQueryClient = registerActiveQueryClient(queryClient);
    invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(() => Promise.resolve());

    mocks.getActivityLogOptions.mockReturnValue({ actorId: 'user-1' });
    mocks.createVentaUseCase.mockResolvedValue({ venta: { id: 'venta-1' } });
    mocks.updateServicioUseCase.mockResolvedValue(undefined);
    mocks.deleteCategoriaUseCase.mockResolvedValue(undefined);
    mocks.cutVentaFromNotificationStoreWorkflow.mockResolvedValue(undefined);
  });

  afterEach(() => {
    unregisterQueryClient();
  });

  it('coordinates createVentaMutation through use-case, reaction event and cache invalidation', async () => {
    const events: StoreEvent[] = [];
    const unsubscribe = storeEventBus.on('VENTA_CREATED', (event) => events.push(event));

    await createVentaMutation({ servicioId: 'servicio-1' } as never);

    unsubscribe();
    expect(mocks.createVentaUseCase).toHaveBeenCalledWith(
      { servicioId: 'servicio-1' },
      { actorId: 'user-1' },
    );
    expect(mocks.syncVentaForecastReadModels).toHaveBeenCalledWith('venta-1');
    expect(events).toEqual([{ type: 'VENTA_CREATED', ventaId: 'venta-1' }]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.ventas.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.servicios.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.terceros.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.pagination.all });
  });

  it('coordinates updateServicioMutation through use-case, reaction event and cache invalidation', async () => {
    const events: StoreEvent[] = [];
    const unsubscribe = storeEventBus.on('SERVICIO_UPDATED', (event) => events.push(event));

    await updateServicioMutation('servicio-1', { nombre: 'Nuevo' } as never);

    unsubscribe();
    expect(mocks.updateServicioUseCase).toHaveBeenCalledWith(
      'servicio-1',
      { nombre: 'Nuevo' },
      { actorId: 'user-1' },
    );
    expect(mocks.syncServicioForecastReadModels).toHaveBeenCalledWith('servicio-1');
    expect(events).toEqual([{ type: 'SERVICIO_UPDATED', servicioId: 'servicio-1' }]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.servicios.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.categorias.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.ventas.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.pagination.all });
  });

  it('coordinates deleteCategoriaMutation through use-case, reaction event and cache invalidation', async () => {
    const events: StoreEvent[] = [];
    const unsubscribe = storeEventBus.on('CATEGORIA_DELETED', (event) => events.push(event));
    const categoria = { id: 'categoria-1', nombre: 'Streaming' };

    await deleteCategoriaMutation('categoria-1', categoria as never);

    unsubscribe();
    expect(mocks.deleteCategoriaUseCase).toHaveBeenCalledWith('categoria-1', {
      categoria,
      actorId: 'user-1',
    });
    expect(events).toEqual([{ type: 'CATEGORIA_DELETED', categoriaId: 'categoria-1' }]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.categorias.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.servicios.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.ventas.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.pagination.all });
  });

  it('coordinates notification action outcome through query reactions', async () => {
    const refreshNotificationCaches = vi.fn().mockResolvedValue(undefined);

    const outcome = await cutVentaFromNotificationUseCase({
      motivoCorte: 'Sin pago',
      refreshNotificationCaches,
      ventaId: 'venta-1',
    });
    await applyNotificationQueryReactions(queryClient, outcome);

    expect(mocks.cutVentaFromNotificationStoreWorkflow).toHaveBeenCalledWith('venta-1', 'Sin pago');
    expect(refreshNotificationCaches).toHaveBeenCalledTimes(1);
    expect(mocks.refreshVentasStoreCache).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.ventas.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.notificaciones.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.ventas.detail('venta-1') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard.all });
  });
});
