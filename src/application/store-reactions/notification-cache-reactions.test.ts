import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(), counts: vi.fn(), deleteVenta: vi.fn(), deleteServicio: vi.fn(),
  toggleRead: vi.fn(), toggleHighlight: vi.fn(),
}));
vi.mock('@/platform/cache/store-query-invalidation', () => ({ invalidateStoreQueries: mocks.invalidate }));
vi.mock('@/application/use-cases/notificaciones/notificaciones-store-use-cases', () => ({
  fetchNotificationCountsUseCase: mocks.counts,
  deleteNotificacionesPorVentaUseCase: mocks.deleteVenta,
  deleteNotificacionesPorServicioUseCase: mocks.deleteServicio,
  toggleNotificacionLeidaUseCase: mocks.toggleRead,
  toggleNotificacionResaltadaUseCase: mocks.toggleHighlight,
}));

import {
  deleteServicioNotificationStoreCache, deleteVentaNotificationStoreCache,
  refreshNotificationListCache, refreshNotificationStoreCache,
  toggleNotificationHighlightedStoreCache, toggleNotificationReadStoreCache,
} from './notification-cache-reactions';

beforeEach(() => vi.clearAllMocks());

describe('notification cache reactions', () => {
  it('runs every cache reaction and associated domain operation', async () => {
    await refreshNotificationListCache();
    await refreshNotificationStoreCache();
    await deleteVentaNotificationStoreCache('v1');
    await deleteServicioNotificationStoreCache('s1');
    await toggleNotificationReadStoreCache('n1', true);
    await toggleNotificationHighlightedStoreCache('n1', false);
    expect(mocks.counts).toHaveBeenCalled();
    expect(mocks.deleteVenta).toHaveBeenCalledWith('v1');
    expect(mocks.deleteServicio).toHaveBeenCalledWith('s1');
    expect(mocks.toggleRead).toHaveBeenCalledWith('n1', true);
    expect(mocks.toggleHighlight).toHaveBeenCalledWith('n1', false);
    expect(mocks.invalidate).toHaveBeenCalledTimes(7);
  });
});
