import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryDocumentsMock = vi.fn();
const updateMock = vi.fn();
const getAllMock = vi.fn();
const syncNotificacionesMock = vi.fn();
const syncUnServicioMock = vi.fn();
const syncUnaVentaMock = vi.fn();
const fetchNotificacionesMock = vi.fn();
const fetchCountsMock = vi.fn();
const setVentasStateMock = vi.fn();

vi.mock('@/lib/firebase/firestore', () => ({
  queryDocuments: queryDocumentsMock,
  update: updateMock,
  getAll: getAllMock,
  COLLECTIONS: {
    VENTAS: 'ventas',
    SERVICIOS: 'servicios',
  },
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

vi.mock('@/store/ventasStore', () => ({
  useVentasStore: {
    setState: setVentasStateMock,
  },
}));

describe('servicioSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryDocumentsMock.mockResolvedValue([]);
    updateMock.mockResolvedValue(undefined);
    getAllMock.mockResolvedValue([]);
    syncNotificacionesMock.mockResolvedValue(undefined);
    syncUnServicioMock.mockResolvedValue(undefined);
    syncUnaVentaMock.mockResolvedValue(undefined);
    fetchNotificacionesMock.mockResolvedValue(undefined);
    fetchCountsMock.mockResolvedValue(undefined);
  });

  it('sincroniza ventas denormalizadas y refresca notificaciones al editar un servicio', async () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    queryDocumentsMock.mockResolvedValue([{ id: 'venta-1' }, { id: 'venta-2' }]);

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

    expect(queryDocumentsMock).toHaveBeenCalledWith('ventas', [
      { field: 'servicioId', operator: '==', value: 'servicio-1' },
    ]);
    expect(updateMock).toHaveBeenNthCalledWith(1, 'ventas', 'venta-1', {
      servicioNombre: 'Netflix nueva',
      servicioCorreo: 'nuevo@demo.com',
      servicioContrasena: 'abcd',
      categoriaId: 'cat-2',
      categoriaNombre: 'Premium',
    });
    expect(updateMock).toHaveBeenNthCalledWith(2, 'ventas', 'venta-2', {
      servicioNombre: 'Netflix nueva',
      servicioCorreo: 'nuevo@demo.com',
      servicioContrasena: 'abcd',
      categoriaId: 'cat-2',
      categoriaNombre: 'Premium',
    });
    expect(setVentasStateMock).toHaveBeenCalledTimes(1);
    expect(syncUnServicioMock).toHaveBeenCalledWith('servicio-1');
    expect(syncUnaVentaMock).toHaveBeenCalledTimes(2);
    expect(syncUnaVentaMock).toHaveBeenCalledWith('venta-1');
    expect(syncUnaVentaMock).toHaveBeenCalledWith('venta-2');
    expect(syncNotificacionesMock).not.toHaveBeenCalled();
    expect(fetchNotificacionesMock).toHaveBeenCalledWith(true);
    expect(fetchCountsMock).toHaveBeenCalledTimes(1);
    expect(dispatchEventSpy).toHaveBeenCalledTimes(2);

    dispatchEventSpy.mockRestore();
  });

  it('resincroniza todos los servicios y fuerza notificaciones una sola vez al final', async () => {
    getAllMock
      .mockResolvedValueOnce([
        // SERVICIOS
        {
          id: 'servicio-1',
          nombre: 'Netflix',
          correo: 'a@demo.com',
          contrasena: '1234',
          categoriaId: 'cat-1',
          categoriaNombre: 'Streaming',
        },
        {
          id: 'servicio-2',
          nombre: 'Disney',
          correo: 'b@demo.com',
          contrasena: '5678',
          categoriaId: 'cat-2',
          categoriaNombre: 'Kids',
        },
      ])
      .mockResolvedValueOnce([
        // VENTAS (getAll — new implementation)
        {
          id: 'venta-1',
          servicioId: 'servicio-1',
          servicioNombre: 'Netflix VIEJO', // outdated — will be updated
          servicioCorreo: 'a@demo.com',
          servicioContrasena: '1234',
          categoriaId: 'cat-1',
          categoriaNombre: 'Streaming',
        },
        {
          id: 'venta-2',
          servicioId: 'servicio-2',
          servicioNombre: 'Disney VIEJO', // outdated — will be updated
          servicioCorreo: 'b@demo.com',
          servicioContrasena: '5678',
          categoriaId: 'cat-2',
          categoriaNombre: 'Kids',
        },
        {
          id: 'venta-3',
          servicioId: 'servicio-2',
          servicioNombre: 'Disney VIEJO', // outdated — will be updated
          servicioCorreo: 'b@demo.com',
          servicioContrasena: '5678',
          categoriaId: 'cat-2',
          categoriaNombre: 'Kids',
        },
      ]);

    const { resyncServiciosDenormalizedData } = await import('./servicioSyncService');

    const result = await resyncServiciosDenormalizedData();

    // New implementation: fetches servicios + all ventas once (2 getAll calls)
    expect(getAllMock).toHaveBeenCalledWith('servicios');
    expect(getAllMock).toHaveBeenCalledWith('ventas');

    // Should NOT use queryDocuments (old per-service approach)
    expect(queryDocumentsMock).not.toHaveBeenCalledWith('ventas', expect.anything());

    // All 3 ventas have outdated snapshots → 3 updates
    expect(updateMock).toHaveBeenCalledWith('ventas', 'venta-1', {
      servicioNombre: 'Netflix',
      servicioCorreo: 'a@demo.com',
      servicioContrasena: '1234',
      categoriaId: 'cat-1',
      categoriaNombre: 'Streaming',
    });
    expect(updateMock).toHaveBeenCalledWith('ventas', 'venta-2', {
      servicioNombre: 'Disney',
      servicioCorreo: 'b@demo.com',
      servicioContrasena: '5678',
      categoriaId: 'cat-2',
      categoriaNombre: 'Kids',
    });
    expect(updateMock).toHaveBeenCalledWith('ventas', 'venta-3', {
      servicioNombre: 'Disney',
      servicioCorreo: 'b@demo.com',
      servicioContrasena: '5678',
      categoriaId: 'cat-2',
      categoriaNombre: 'Kids',
    });

    expect(result).toEqual({ serviciosRevisados: 2, ventasActualizadas: 3 });
    expect(syncNotificacionesMock).toHaveBeenCalledTimes(1);
    expect(fetchNotificacionesMock).toHaveBeenCalledWith(true);
    expect(fetchCountsMock).toHaveBeenCalledTimes(1);
  });

  it('omite la escritura en ventas cuyo snapshot ya está actualizado', async () => {
    getAllMock
      .mockResolvedValueOnce([
        // SERVICIOS
        {
          id: 'servicio-1',
          nombre: 'Netflix',
          correo: 'a@demo.com',
          contrasena: '1234',
          categoriaId: 'cat-1',
          categoriaNombre: 'Streaming',
        },
      ])
      .mockResolvedValueOnce([
        // VENTAS — snapshot ya actualizado, sin diferencias
        {
          id: 'venta-1',
          servicioId: 'servicio-1',
          servicioNombre: 'Netflix',
          servicioCorreo: 'a@demo.com',
          servicioContrasena: '1234',
          categoriaId: 'cat-1',
          categoriaNombre: 'Streaming',
        },
      ]);

    const { resyncServiciosDenormalizedData } = await import('./servicioSyncService');

    const result = await resyncServiciosDenormalizedData();

    // venta-1 is already up-to-date → no writes
    expect(updateMock).not.toHaveBeenCalled();
    expect(result).toEqual({ serviciosRevisados: 1, ventasActualizadas: 0 });
  });
});
