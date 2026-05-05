import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getByIdMock = vi.fn();
const queryDocumentsMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const removeMock = vi.fn();

vi.mock('@/lib/supabase/notifications-repository', () => ({
  createNotificacion: createMock,
  queryNotificaciones: queryDocumentsMock,
  removeNotificacion: removeMock,
  updateNotificacion: updateMock,
}));

vi.mock('@/lib/supabase/servicios-repository', () => ({
  getServicioById: getByIdMock,
}));

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

describe('notificationSyncService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    vi.clearAllMocks();

    queryDocumentsMock.mockResolvedValue([]);
    createMock.mockResolvedValue('notificacion-1');
    updateMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
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

    const { sincronizarUnServicio } = await import('./notificationSyncService');

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
          metodoPagoTarjetaTerminacion: '',
          renovacionAutomatica: true,
        },
      ])
      .mockResolvedValueOnce([]);

    const { sincronizarUnServicio } = await import('./notificationSyncService');

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
});
