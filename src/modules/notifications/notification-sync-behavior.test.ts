import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getByIdMock,
  queryDocumentsMock,
  createMock,
  updateMock,
  removeMock,
  getMetodoPagoByIdMock,
} = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  queryDocumentsMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  removeMock: vi.fn(),
  getMetodoPagoByIdMock: vi.fn(),
}));

vi.mock('@/platform/supabase/notifications-repository', () => ({
  createNotificacion: createMock,
  queryNotificaciones: queryDocumentsMock,
  removeNotificacion: removeMock,
  updateNotificacion: updateMock,
}));

vi.mock('@/platform/supabase/servicios-repository', () => ({
  getServicioById: getByIdMock,
  removePagoServicio: vi.fn(),
}));

vi.mock('@/platform/supabase/catalogos-repository', () => ({
  getMetodoPagoById: getMetodoPagoByIdMock,
  queryMetodosPago: vi.fn().mockResolvedValue([]),
}));

import { sincronizarUnServicio } from '@/modules/notifications';

const servicioBase = {
  id: 'servicio-1',
  activo: true,
  categoriaId: 'categoria-1',
  categoriaNombre: 'Streaming',
  nombre: 'Netflix',
  tipo: 'tipo-streaming-individual',
  tipoNombre: 'Streaming Individual',
  correo: 'netflix@example.com',
  contrasena: 'password',
  metodoPagoNombre: 'Tarjeta principal',
  moneda: 'USD',
  costoServicio: 12,
  cicloPago: 'mensual',
  fechaVencimiento: new Date('2026-05-05T12:00:00.000Z'),
};

describe('notifications module sync', () => {
  it('preserves customer read notifications after renewing the service and synchronizing again', async () => {
    getByIdMock.mockResolvedValue({ ...servicioBase, fechaVencimiento: new Date('2099-06-01') });
    const customerNotification = { id: 'customer-read', entidad: 'venta', servicioId: 'servicio-1', leida: true, resaltada: false };
    const rows = new Map([
      ['customer-read', customerNotification],
      ['service-expired', { id: 'service-expired', entidad: 'servicio', servicioId: 'servicio-1', leida: false, resaltada: false }],
    ]);
    queryDocumentsMock.mockImplementation(async (filters: Array<{ field: string; value: string }>) =>
      [...rows.values()].filter(row => filters.every(filter => row[filter.field as keyof typeof row] === filter.value)),
    );
    removeMock.mockImplementation(async (id: string) => { rows.delete(id); });

    await sincronizarUnServicio('servicio-1');
    await sincronizarUnServicio('servicio-1');

    expect([...rows.values()]).toEqual([customerNotification]);
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith('service-expired');
    expect(createMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    vi.clearAllMocks();

    queryDocumentsMock.mockResolvedValue([]);
    createMock.mockResolvedValue('notificacion-1');
    updateMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
    getMetodoPagoByIdMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('denormaliza renovacionAutomatica al crear una notificacion de servicio', async () => {
    getByIdMock.mockResolvedValue({
      ...servicioBase,
      renovacionAutomatica: true,
    });
    queryDocumentsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await sincronizarUnServicio('servicio-1');

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: 'servicio',
        servicioId: 'servicio-1',
        renovacionAutomatica: true,
      })
    );
  });

  it('actualiza renovacionAutomatica sin perder leida ni resaltada', async () => {
    getByIdMock.mockResolvedValue({
      ...servicioBase,
      renovacionAutomatica: false,
    });
    queryDocumentsMock
      .mockResolvedValueOnce([
        {
          id: 'notificacion-1',
          entidad: 'servicio',
          servicioId: 'servicio-1',
          prioridad: 'media',
          diasRestantes: 6,
          leida: true,
          resaltada: true,
          metodoPagoNombre: 'Tarjeta principal',
          metodoPagoAlias: '',
          metodoPagoTarjetaTerminacion: '',
          renovacionAutomatica: true,
        },
      ])
      .mockResolvedValueOnce([]);

    await sincronizarUnServicio('servicio-1');

    expect(updateMock).toHaveBeenCalledWith(
      'notificacion-1',
      expect.objectContaining({
        renovacionAutomatica: false,
        leida: true,
        resaltada: true,
      })
    );
  });

  it('denormaliza alias y terminacion de tarjeta del metodo de pago de servicio', async () => {
    getByIdMock.mockResolvedValue({
      ...servicioBase,
      metodoPagoId: 'metodo-1',
    });
    getMetodoPagoByIdMock.mockResolvedValue({
      id: 'metodo-1',
      alias: 'Personal',
      numeroTarjeta: '4111 1111 1111 4321',
    });
    queryDocumentsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await sincronizarUnServicio('servicio-1');

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: 'servicio',
        metodoPagoAlias: 'Personal',
        metodoPagoTarjetaTerminacion: '4321',
      })
    );
  });
});
