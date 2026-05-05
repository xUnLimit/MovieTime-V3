import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryVentasMock = vi.fn();
const getServiciosMock = vi.fn();
const syncNotificacionesMock = vi.fn();
const syncUnServicioMock = vi.fn();
const syncUnaVentaMock = vi.fn();
const fetchNotificacionesMock = vi.fn();
const fetchCountsMock = vi.fn();

vi.mock('@/lib/supabase/servicios-repository', () => ({
  getServicios: getServiciosMock,
  ENTITIES: {
    SERVICIOS: 'servicios',
  },
}));

vi.mock('@/lib/supabase/ventas-repository', () => ({
  queryVentas: queryVentasMock,
}));

vi.mock('@/lib/services/notificationSyncService', () => ({
  sincronizarNotificacionesForzado: syncNotificacionesMock,
  sincronizarUnServicio: syncUnServicioMock,
  sincronizarUnaVenta: syncUnaVentaMock,
}));

vi.mock('@/store/notificacionesStore', () => ({
  useNotificacionesStore: {
    getState: () => ({
      fetchNotificaciones: fetchNotificacionesMock,
      fetchCounts: fetchCountsMock,
    }),
  },
}));

describe('servicioSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryVentasMock.mockResolvedValue([]);
    getServiciosMock.mockResolvedValue([]);
    syncNotificacionesMock.mockResolvedValue(undefined);
    syncUnServicioMock.mockResolvedValue(undefined);
    syncUnaVentaMock.mockResolvedValue(undefined);
    fetchNotificacionesMock.mockResolvedValue(undefined);
    fetchCountsMock.mockResolvedValue(undefined);
  });

  describe('syncServicioDependencias', () => {
    it('regenera notificaciones del servicio y sus ventas asociadas', async () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
      queryVentasMock.mockResolvedValue([{ id: 'venta-1' }, { id: 'venta-2' }]);

      const { syncServicioDependencias } = await import('./servicioSyncService');

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
      expect(fetchNotificacionesMock).toHaveBeenCalledWith(true);
      expect(fetchCountsMock).toHaveBeenCalledTimes(1);
      expect(dispatchEventSpy).toHaveBeenCalled();

      dispatchEventSpy.mockRestore();
    });

    it('no llama a sincronizarUnaVenta si el servicio no tiene ventas asociadas', async () => {
      queryVentasMock.mockResolvedValue([]);

      const { syncServicioDependencias } = await import('./servicioSyncService');

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

      const { resyncServiciosDenormalizedData } = await import('./servicioSyncService');
      const result = await resyncServiciosDenormalizedData();

      expect(syncNotificacionesMock).toHaveBeenCalledTimes(1);
      expect(fetchNotificacionesMock).toHaveBeenCalledWith(true);
      expect(fetchCountsMock).toHaveBeenCalledTimes(1);
      // V2: sale display fields come from views — no writes to ventas
      expect(result).toEqual({ serviciosRevisados: 2, ventasActualizadas: 0 });
    });

    it('devuelve serviciosRevisados=0 cuando no hay servicios', async () => {
      getServiciosMock.mockResolvedValue([]);

      const { resyncServiciosDenormalizedData } = await import('./servicioSyncService');
      const result = await resyncServiciosDenormalizedData();

      expect(result).toEqual({ serviciosRevisados: 0, ventasActualizadas: 0 });
    });
  });
});
