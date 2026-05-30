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
