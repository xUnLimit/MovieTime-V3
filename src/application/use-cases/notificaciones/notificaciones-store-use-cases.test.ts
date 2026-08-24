import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/supabase/domain-read-adapters', () => ({
  queryNotificationIdsRead: vi.fn(),
  queryNotificationsRead: vi.fn(),
}));

vi.mock('@/platform/supabase/notifications-repository', () => ({
  countNotificaciones: vi.fn(),
  removeNotificacion: vi.fn(),
  updateNotificacion: vi.fn(),
}));

import {
  queryNotificationIdsRead,
  queryNotificationsRead,
} from '@/platform/supabase/domain-read-adapters';
import {
  countNotificaciones,
  removeNotificacion,
  updateNotificacion,
} from '@/platform/supabase/notifications-repository';
import {
  deleteNotificacionUseCase,
  deleteNotificacionesPorServicioUseCase,
  deleteNotificacionesPorVentaUseCase,
  fetchNotificationCountsUseCase,
  setVentaPaymentPromiseUseCase,
  toggleNotificacionLeidaUseCase,
  toggleNotificacionResaltadaUseCase,
} from './notificaciones-store-use-cases';

describe('notificaciones store use cases', () => {
  beforeEach(() => {
    vi.mocked(countNotificaciones).mockReset().mockResolvedValue(0);
    vi.mocked(queryNotificationsRead).mockReset().mockResolvedValue([]);
    vi.mocked(queryNotificationIdsRead).mockReset().mockResolvedValue([]);
    vi.mocked(removeNotificacion).mockReset().mockResolvedValue(undefined);
    vi.mocked(updateNotificacion).mockReset().mockResolvedValue(undefined);
  });

  it('fetches count dependencies without exposing repository details to stores', async () => {
    await fetchNotificationCountsUseCase();

    expect(countNotificaciones).toHaveBeenCalledTimes(4);
    expect(queryNotificationsRead).toHaveBeenCalledTimes(2);
  });

  it('updates read and highlighted flags', async () => {
    await toggleNotificacionLeidaUseCase('notif-1', true);
    await toggleNotificacionResaltadaUseCase('notif-2', false);

    expect(updateNotificacion).toHaveBeenNthCalledWith(
      1,
      'notif-1',
      expect.objectContaining({ leida: true }),
    );
    expect(updateNotificacion).toHaveBeenNthCalledWith(
      2,
      'notif-2',
      expect.objectContaining({ resaltada: false }),
    );
  });

  it('stores a future venta payment promise and marks the notification as read', async () => {
    const promisedDate = new Date(2026, 7, 24);

    await setVentaPaymentPromiseUseCase(
      'notif-1',
      promisedDate,
      new Date('2026-08-23T15:00:00.000Z'),
    );

    expect(updateNotificacion).toHaveBeenCalledWith(
      'notif-1',
      expect.objectContaining({
        fechaPrometidaPago: promisedDate,
        leida: true,
      }),
    );
  });

  it('clears a payment promise without changing the read state', async () => {
    await setVentaPaymentPromiseUseCase('notif-1', null);

    expect(updateNotificacion).toHaveBeenCalledWith(
      'notif-1',
      expect.objectContaining({ fechaPrometidaPago: null }),
    );
    expect(updateNotificacion).not.toHaveBeenCalledWith(
      'notif-1',
      expect.objectContaining({ leida: expect.anything() }),
    );
  });

  it('rejects today and past payment promise dates', async () => {
    await expect(
      setVentaPaymentPromiseUseCase(
        'notif-1',
        new Date(2026, 7, 23),
        new Date('2026-08-23T15:00:00.000Z'),
      ),
    ).rejects.toThrow('La fecha prometida debe ser posterior a hoy');

    expect(updateNotificacion).not.toHaveBeenCalled();
  });

  it('deletes a single notification', async () => {
    await deleteNotificacionUseCase('notif-1');

    expect(removeNotificacion).toHaveBeenCalledWith('notif-1');
  });

  it('deletes venta notifications found by the read adapter', async () => {
    vi.mocked(queryNotificationIdsRead).mockResolvedValueOnce([
      { id: 'notif-1' },
      { id: 'notif-2' },
    ]);

    await deleteNotificacionesPorVentaUseCase('venta-1');

    expect(queryNotificationIdsRead).toHaveBeenCalledWith([
      { field: 'entidad', operator: '==', value: 'venta' },
      { field: 'ventaId', operator: '==', value: 'venta-1' },
    ]);
    expect(removeNotificacion).toHaveBeenCalledWith('notif-1');
    expect(removeNotificacion).toHaveBeenCalledWith('notif-2');
  });

  it('deletes servicio notifications found by the read adapter', async () => {
    vi.mocked(queryNotificationIdsRead).mockResolvedValueOnce([
      { id: 'notif-3' },
    ]);

    await deleteNotificacionesPorServicioUseCase('servicio-1');

    expect(queryNotificationIdsRead).toHaveBeenCalledWith([
      { field: 'servicioId', operator: '==', value: 'servicio-1' },
    ]);
    expect(removeNotificacion).toHaveBeenCalledWith('notif-3');
  });
});
