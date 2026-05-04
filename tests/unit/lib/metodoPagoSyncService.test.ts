import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMock = vi.fn();
const queryDocumentsMock = vi.fn();

vi.mock('@/lib/firebase/firestore', () => ({
  update: updateMock,
  queryDocuments: queryDocumentsMock,
  COLLECTIONS: {
    VENTAS: 'ventas',
    PAGOS_VENTA: 'pagosVenta',
    SERVICIOS: 'servicios',
    PAGOS_SERVICIO: 'pagosServicio',
  },
}));

describe('syncMetodoPagoDependencias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no documents found in any collection
    queryDocumentsMock.mockResolvedValue([]);
    updateMock.mockResolvedValue(undefined);
  });

  it('no hace nada si nombre y moneda no cambiaron', async () => {
    const { syncMetodoPagoDependencias } = await import('@/lib/services/metodoPagoSyncService');

    await syncMetodoPagoDependencias({
      id: 'metodo-1',
      nombre: 'Yappy',
      moneda: 'USD',
      nombreAnterior: 'Yappy',
      monedaAnterior: 'USD',
    });

    expect(queryDocumentsMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('sincroniza metodoPagoNombre en ventas y servicios cuando cambia el nombre', async () => {
    const { syncMetodoPagoDependencias } = await import('@/lib/services/metodoPagoSyncService');

    queryDocumentsMock
      .mockResolvedValueOnce([{ id: 'venta-1' }, { id: 'venta-2' }]) // VENTAS
      .mockResolvedValueOnce([{ id: 'pago-1' }])                     // PAGOS_VENTA
      .mockResolvedValueOnce([{ id: 'servicio-1' }])                  // SERVICIOS
      .mockResolvedValueOnce([]);                                     // PAGOS_SERVICIO

    await syncMetodoPagoDependencias({
      id: 'metodo-1',
      nombre: 'Yappy 2.0',
      nombreAnterior: 'Yappy',
    });

    // Ventas: metodoPagoNombre actualizado
    expect(updateMock).toHaveBeenCalledWith('ventas', 'venta-1', { metodoPagoNombre: 'Yappy 2.0' });
    expect(updateMock).toHaveBeenCalledWith('ventas', 'venta-2', { metodoPagoNombre: 'Yappy 2.0' });

    // PagosVenta: metodoPago actualizado
    expect(updateMock).toHaveBeenCalledWith('pagosVenta', 'pago-1', { metodoPago: 'Yappy 2.0' });

    // Servicios: metodoPagoNombre actualizado
    expect(updateMock).toHaveBeenCalledWith('servicios', 'servicio-1', { metodoPagoNombre: 'Yappy 2.0' });

    // Total: 4 escrituras (venta-1, venta-2, pago-1, servicio-1)
    expect(updateMock).toHaveBeenCalledTimes(4);
  });

  it('sincroniza moneda en ventas y pagos cuando cambia la moneda', async () => {
    const { syncMetodoPagoDependencias } = await import('@/lib/services/metodoPagoSyncService');

    queryDocumentsMock
      .mockResolvedValueOnce([{ id: 'venta-1' }]) // VENTAS
      .mockResolvedValueOnce([{ id: 'pago-1' }])  // PAGOS_VENTA
      .mockResolvedValueOnce([])                   // SERVICIOS
      .mockResolvedValueOnce([{ id: 'ps-1' }]);   // PAGOS_SERVICIO

    await syncMetodoPagoDependencias({
      id: 'metodo-1',
      moneda: 'PAB',
      monedaAnterior: 'USD',
    });

    expect(updateMock).toHaveBeenCalledWith('ventas', 'venta-1', { moneda: 'PAB' });
    expect(updateMock).toHaveBeenCalledWith('pagosVenta', 'pago-1', { moneda: 'PAB' });
    expect(updateMock).toHaveBeenCalledWith('pagosServicio', 'ps-1', { moneda: 'PAB' });
    expect(updateMock).toHaveBeenCalledTimes(3);
  });

  it('sincroniza nombre y moneda juntos cuando ambos cambian', async () => {
    const { syncMetodoPagoDependencias } = await import('@/lib/services/metodoPagoSyncService');

    queryDocumentsMock
      .mockResolvedValueOnce([{ id: 'venta-1' }]) // VENTAS
      .mockResolvedValueOnce([])                   // PAGOS_VENTA
      .mockResolvedValueOnce([])                   // SERVICIOS
      .mockResolvedValueOnce([]);                  // PAGOS_SERVICIO

    await syncMetodoPagoDependencias({
      id: 'metodo-1',
      nombre: 'Nequi',
      moneda: 'COP',
      nombreAnterior: 'Yappy',
      monedaAnterior: 'USD',
    });

    // Both nombre and moneda should be in the update payload
    expect(updateMock).toHaveBeenCalledWith('ventas', 'venta-1', {
      metodoPagoNombre: 'Nequi',
      moneda: 'COP',
    });
  });

  it('no llama a update si no hay documentos en ninguna colección', async () => {
    const { syncMetodoPagoDependencias } = await import('@/lib/services/metodoPagoSyncService');

    queryDocumentsMock.mockResolvedValue([]);

    await syncMetodoPagoDependencias({
      id: 'metodo-empty',
      nombre: 'Nuevo Nombre',
      nombreAnterior: 'Viejo Nombre',
    });

    expect(queryDocumentsMock).toHaveBeenCalledTimes(4);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
