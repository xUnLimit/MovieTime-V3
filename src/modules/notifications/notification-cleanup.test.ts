import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationsRepository = vi.hoisted(() => ({
  removeNotificacion: vi.fn(),
}));

vi.mock('@/platform/supabase/notifications-repository', () => notificationsRepository);

import { limpiarNotificacionesHuerfanas } from './notification-cleanup';

describe('notification cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes notifications whose source venta, servicio or reposo no longer exists', async () => {
    await limpiarNotificacionesHuerfanas(
      [{ id: 'venta-activa' }] as never,
      [{ id: 'servicio-activo' }] as never,
      [{ id: 'reposo-activo' }] as never,
      [
        { id: 'notif-venta-ok', entidad: 'venta', ventaId: 'venta-activa' },
        { id: 'notif-venta-huerfana', entidad: 'venta', ventaId: 'venta-borrada' },
      ] as never,
      [
        { id: 'notif-servicio-ok', entidad: 'servicio', servicioId: 'servicio-activo' },
        { id: 'notif-servicio-huerfana', entidad: 'servicio', servicioId: 'servicio-borrado' },
      ] as never,
      [
        { id: 'notif-reposo-ok', entidad: 'reposo', servicioId: 'reposo-activo' },
        { id: 'notif-reposo-huerfana', entidad: 'reposo', servicioId: 'reposo-borrado' },
      ] as never,
    );

    expect(notificationsRepository.removeNotificacion).toHaveBeenCalledTimes(3);
    expect(notificationsRepository.removeNotificacion).toHaveBeenCalledWith('notif-venta-huerfana');
    expect(notificationsRepository.removeNotificacion).toHaveBeenCalledWith('notif-servicio-huerfana');
    expect(notificationsRepository.removeNotificacion).toHaveBeenCalledWith('notif-reposo-huerfana');
  });

  it('swallows cleanup failures because cleanup is best-effort', async () => {
    notificationsRepository.removeNotificacion.mockRejectedValueOnce(new Error('network'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(limpiarNotificacionesHuerfanas(
      [],
      [],
      [],
      [{ id: 'notif-venta-huerfana', entidad: 'venta', ventaId: 'venta-borrada' }] as never,
      [],
      [],
    )).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
