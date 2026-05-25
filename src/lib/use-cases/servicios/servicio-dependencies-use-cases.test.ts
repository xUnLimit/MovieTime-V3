import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryVentasMock = vi.fn();
const getServiciosMock = vi.fn();
const syncNotificacionesMock = vi.fn();
const syncUnServicioMock = vi.fn();
const syncUnaVentaMock = vi.fn();
const refreshNotificationStoreCacheMock = vi.fn();

vi.mock('@/lib/supabase/servicios-repository', () => ({
  getServicios: getServiciosMock,
  ENTITIES: {
    SERVICIOS: 'servicios',
  },
}));

vi.mock('@/lib/supabase/ventas-repository', () => ({
  queryVentas: queryVentasMock,
}));

vi.mock('@/lib/notifications', () => ({
  sincronizarNotificacionesForzado: syncNotificacionesMock,
  sincronizarUnServicio: syncUnServicioMock,
  sincronizarUnaVenta: syncUnaVentaMock,
}));

vi.mock('@/lib/store-reactions/notification-cache-reactions', () => ({
  refreshNotificationStoreCache: refreshNotificationStoreCacheMock,
}));

describe('servicio-dependencies-use-cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryVentasMock.mockResolvedValue([]);
    getServiciosMock.mockResolvedValue([]);
    syncNotificacionesMock.mockResolvedValue(undefined);
    syncUnServicioMock.mockResolvedValue(undefined);
    syncUnaVentaMock.mockResolvedValue(undefined);
    refreshNotificationStoreCacheMock.mockResolvedValue(undefined);
  });

  describe('syncServicioDependencias', () => {
    it('regenera notificaciones del servicio y sus ventas asociadas', async () => {
      queryVentasMock.mockResolvedValue([{ id: 'venta-1' }, { id: 'venta-2' }]);

      const { storeEventBus } = await import('@/lib/events/store-event-bus');
      const servicioUpdated = vi.fn();
      const ventaUpdated = vi.fn();
      const unsubscribeServicio = storeEventBus.on('SERVICIO_UPDATED', servicioUpdated);
      const unsubscribeVenta = storeEventBus.on('VENTA_UPDATED', ventaUpdated);
      const { syncServicioDependencias } = await import('./servicio-dependencies-use-cases');

      await syncServicioDependencias(
        {
          id: 'servicio-1',
          nombre: 'Netflix vieja',
          correo: 'viejo@demo.com',
          contrasena: '1234',
          categoriaId: 'cat-1',
          categoriaNombre: 'Streaming',
        },
        {
          id: 'servicio-1',
          nombre: 'Netflix nueva',
          correo: 'nuevo@demo.com',
          contrasena: 'abcd',
          categoriaId: 'cat-2',
          categoriaNombre: 'Premium',
        }
      );

      expect(queryVentasMock).toHaveBeenCalledWith([
        { field: 'servicioId', operator: '==', value: 'servicio-1' },
      ]);
      expect(syncUnServicioMock).toHaveBeenCalledWith('servicio-1');
      expect(syncUnaVentaMock).toHaveBeenCalledTimes(2);
      expect(syncUnaVentaMock).toHaveBeenCalledWith('venta-1');
      expect(syncUnaVentaMock).toHaveBeenCalledWith('venta-2');
      expect(servicioUpdated).toHaveBeenCalledWith({
        type: 'SERVICIO_UPDATED',
        servicioId: 'servicio-1',
      });
      expect(ventaUpdated).toHaveBeenCalledWith({ type: 'VENTA_UPDATED', ventaId: 'venta-1' });
      expect(ventaUpdated).toHaveBeenCalledWith({ type: 'VENTA_UPDATED', ventaId: 'venta-2' });

      unsubscribeServicio();
      unsubscribeVenta();
    });

    it('no llama a sincronizarUnaVenta si el servicio no tiene ventas asociadas', async () => {
      queryVentasMock.mockResolvedValue([]);

      const { syncServicioDependencias } = await import('./servicio-dependencies-use-cases');

      await syncServicioDependencias(
        { id: 'servicio-1', nombre: 'A', correo: '', contrasena: '', categoriaId: 'cat-1', categoriaNombre: '' },
        { id: 'servicio-1', nombre: 'B', correo: '', contrasena: '', categoriaId: 'cat-1', categoriaNombre: '' }
      );

      expect(syncUnServicioMock).toHaveBeenCalledWith('servicio-1');
      expect(syncUnaVentaMock).not.toHaveBeenCalled();
    });
  });

  describe('resyncServiciosDenormalizedData', () => {
    it('fuerza notificaciones y refresca el store, sin escribir campos en ventas', async () => {
      getServiciosMock.mockResolvedValue([
        { id: 'servicio-1', nombre: 'Netflix', correo: 'a@demo.com', contrasena: '1234', categoriaId: 'cat-1', categoriaNombre: 'Streaming' },
        { id: 'servicio-2', nombre: 'Disney', correo: 'b@demo.com', contrasena: '5678', categoriaId: 'cat-2', categoriaNombre: 'Kids' },
      ]);

      const { resyncServiciosDenormalizedData } = await import('./servicio-dependencies-use-cases');
      const result = await resyncServiciosDenormalizedData();

      expect(syncNotificacionesMock).toHaveBeenCalledTimes(1);
      // V2: sale display fields come from views — no writes to ventas
      expect(result).toEqual({ serviciosRevisados: 2, ventasActualizadas: 0 });
    });

    it('devuelve serviciosRevisados=0 cuando no hay servicios', async () => {
      getServiciosMock.mockResolvedValue([]);

      const { resyncServiciosDenormalizedData } = await import('./servicio-dependencies-use-cases');
      const result = await resyncServiciosDenormalizedData();

      expect(result).toEqual({ serviciosRevisados: 0, ventasActualizadas: 0 });
    });
  });
});
