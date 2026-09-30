import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryVentasMock = vi.fn();
const syncUnServicioMock = vi.fn();
const syncUnaVentaMock = vi.fn();

vi.mock('@/platform/supabase/ventas-repository', () => ({
  queryVentas: queryVentasMock,
}));

vi.mock('@/modules/notifications', () => ({
  sincronizarUnServicio: syncUnServicioMock,
  sincronizarUnaVenta: syncUnaVentaMock,
}));

describe('servicio-dependencies-use-cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryVentasMock.mockResolvedValue([]);
    syncUnServicioMock.mockResolvedValue(undefined);
    syncUnaVentaMock.mockResolvedValue(undefined);
  });

  describe('syncServicioDependencias', () => {
    it('regenera notificaciones del servicio y sus ventas asociadas', async () => {
      queryVentasMock.mockResolvedValue([{ id: 'venta-1' }, { id: 'venta-2' }]);

      const { storeEventBus } = await import('@/platform/events/store-event-bus');
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
});
