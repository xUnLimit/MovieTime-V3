import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notifications: vi.fn(), ventas: vi.fn(), servicios: vi.fn(), metodos: vi.fn(),
  venta: vi.fn(), servicio: vi.fn(), reposo: vi.fn(), cleanup: vi.fn(), error: vi.fn(),
}));
vi.mock('@/platform/supabase/notifications-repository', () => ({ queryNotificaciones: mocks.notifications }));
vi.mock('@/platform/supabase/ventas-repository', () => ({ queryVentas: mocks.ventas }));
vi.mock('@/platform/supabase/servicios-repository', () => ({ queryServicios: mocks.servicios }));
vi.mock('@/platform/supabase/catalogos-repository', () => ({ queryMetodosPago: mocks.metodos }));
vi.mock('./venta-notification-sync', () => ({ procesarNotificacionVenta: mocks.venta }));
vi.mock('./servicio-notification-sync', () => ({ procesarNotificacionServicio: mocks.servicio }));
vi.mock('./reposo-notification-sync', () => ({ procesarNotificacionReposo: mocks.reposo }));
vi.mock('./notification-cleanup', () => ({ limpiarNotificacionesHuerfanas: mocks.cleanup }));
vi.mock('@/platform/observability/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: mocks.error }),
}));

import { runBulkNotificationSync } from './notification-bulk-sync';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notifications
    .mockResolvedValueOnce([{ id: 'nv', ventaId: 'v1' }])
    .mockResolvedValueOnce([{ id: 'ns', servicioId: 's1' }])
    .mockResolvedValueOnce([{ id: 'nr', servicioId: 'r1' }]);
  mocks.ventas.mockResolvedValue([{ id: 'v1' }]);
  mocks.servicios.mockResolvedValueOnce([{ id: 's1' }]).mockResolvedValueOnce([{ id: 'r1' }]);
  mocks.metodos.mockResolvedValue([{ id: 'm1' }]);
  mocks.venta.mockResolvedValue(undefined);
  mocks.servicio.mockResolvedValue(undefined);
  mocks.reposo.mockResolvedValue(undefined);
  mocks.cleanup.mockResolvedValue(undefined);
});

describe('bulk notification sync', () => {
  it('processes sales, services and rests with indexed existing data', async () => {
    await expect(runBulkNotificationSync(true)).resolves.toEqual({ huboFallosParciales: false });
    expect(mocks.venta).toHaveBeenCalledWith(
      { id: 'v1' }, { id: 'nv', ventaId: 'v1' }, true, expect.any(Map),
    );
    expect(mocks.servicio).toHaveBeenCalledWith(
      { id: 's1' }, { id: 'ns', servicioId: 's1' }, true, expect.any(Map),
    );
    expect(mocks.reposo).toHaveBeenCalledWith(
      { id: 'r1' }, { id: 'nr', servicioId: 'r1' }, true,
    );
    expect(mocks.cleanup).toHaveBeenCalledWith(
      [{ id: 'v1' }], [{ id: 's1' }], [{ id: 'r1' }],
      [{ id: 'nv', ventaId: 'v1' }], [{ id: 'ns', servicioId: 's1' }], [{ id: 'nr', servicioId: 'r1' }],
    );
  });

  it('continues cleanup and reports every partial processor failure', async () => {
    mocks.venta.mockRejectedValue(new Error('venta'));
    mocks.servicio.mockRejectedValue(new Error('servicio'));
    mocks.reposo.mockRejectedValue(new Error('reposo'));
    await expect(runBulkNotificationSync(false)).resolves.toEqual({ huboFallosParciales: true });
    expect(mocks.error).toHaveBeenCalledTimes(3);
    expect(mocks.cleanup).toHaveBeenCalled();
  });
});
