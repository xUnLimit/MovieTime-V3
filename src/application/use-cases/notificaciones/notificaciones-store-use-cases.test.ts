import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/supabase/domain-read-adapters', () => ({
  queryNotificationIdsRead: vi.fn(),
  queryNotificationsRead: vi.fn(),
}));

vi.mock('@/platform/supabase/notifications-repository', () => ({
  removeNotificacion: vi.fn(),
  updateNotificacion: vi.fn(),
}));

import {
  queryNotificationIdsRead,
  queryNotificationsRead,
} from '@/platform/supabase/domain-read-adapters';
import { removeNotificacion, updateNotificacion } from '@/platform/supabase/notifications-repository';
import { deleteNotificacionUseCase, deleteNotificacionesPorServicioUseCase, deleteNotificacionesPorVentaUseCase, setVentaPaymentPromiseUseCase, toggleNotificacionLeidaUseCase, toggleNotificacionResaltadaUseCase } from './notificaciones-store-use-cases';

describe('notificaciones store use cases', () => {
  beforeEach(() => {
    vi.mocked(queryNotificationsRead).mockReset().mockResolvedValue([]);
    vi.mocked(queryNotificationIdsRead).mockReset().mockResolvedValue([]);
    vi.mocked(removeNotificacion).mockReset().mockResolvedValue(undefined);
    vi.mocked(updateNotificacion).mockReset().mockResolvedValue(undefined);
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

  it.each([
    ['today', new Date(2026, 7, 23)],
    ['past', new Date(2026, 7, 20)],
  ])('stores a %s payment promise date', async (_label, promisedDate) => {
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

  it('rejects an invalid payment promise date', async () => {
    await expect(
      setVentaPaymentPromiseUseCase(
        'notif-1',
        new Date(Number.NaN),
        new Date('2026-08-23T15:00:00.000Z'),
      ),
    ).rejects.toThrow('La fecha prometida no es válida');

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
