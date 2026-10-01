import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityLogOptions } from '@/platform/activity/activity-log-adapter';

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(), invalidate: vi.fn(), updateVenta: vi.fn(), updateServicio: vi.fn(),
  deleteServicio: vi.fn(), deleteNotification: vi.fn(), deleteByServicio: vi.fn(), deleteByVenta: vi.fn(),
}));
vi.mock('@/platform/query-client-registry', () => ({ getActiveQueryClient: mocks.getClient }));
vi.mock('@/platform/cache/store-query-invalidation', () => ({ invalidateStoreQueries: mocks.invalidate }));
vi.mock('@/application/use-cases/ventas/ventas-write-use-cases', () => ({ updateVentaUseCase: mocks.updateVenta }));
vi.mock('@/application/use-cases/servicios/servicios-write-use-cases', () => ({
  updateServicioUseCase: mocks.updateServicio, deleteServicioUseCase: mocks.deleteServicio,
}));
vi.mock('@/application/use-cases/notificaciones/notificaciones-store-use-cases', () => ({
  deleteNotificacionUseCase: mocks.deleteNotification,
  deleteNotificacionesPorServicioUseCase: mocks.deleteByServicio,
  deleteNotificacionesPorVentaUseCase: mocks.deleteByVenta,
}));

import { activateReposoServicioStoreWorkflow, cutVentaFromNotificationStoreWorkflow, deleteNotificationStoreItem, deleteReposoServicioStoreWorkflow, deleteVentaNotificationsStoreWorkflow, getCurrentMetodosPagoStoreSnapshot, inactivateServicioFromNotificationStoreWorkflow, refreshVentasStoreCache } from './notificaciones-workflow-reactions';

const log: ActivityLogOptions = {
  logContext: { usuarioId: 'u1', usuarioEmail: 'a@b.com' },
  recordActivityLog: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => vi.clearAllMocks());

describe('notification store workflows', () => {
  it('cuts a sale and clears its notifications', async () => {
    await cutVentaFromNotificationStoreWorkflow('v1', 'impago', log);
    expect(mocks.updateVenta).toHaveBeenCalledWith('v1', expect.objectContaining({
      estado: 'inactivo', cortadaAt: expect.any(Date), motivoCorte: 'impago',
    }), log);
    expect(mocks.deleteByVenta).toHaveBeenCalledWith('v1');
  });

  it('inactivates, activates and deletes resting services', async () => {
    await inactivateServicioFromNotificationStoreWorkflow('s1', log);
    await activateReposoServicioStoreWorkflow('s1', { activo: true }, log);
    await deleteReposoServicioStoreWorkflow('s1', true, log);
    expect(mocks.updateServicio).toHaveBeenCalledWith('s1', { activo: false }, log);
    expect(mocks.updateServicio).toHaveBeenCalledWith('s1', { activo: true }, log);
    expect(mocks.deleteServicio).toHaveBeenCalledWith('s1', expect.objectContaining({
      deletePayments: true,
      logContext: expect.objectContaining({ usuarioId: 'u1' }),
    }));
  });

  it('deletes one notification and entity notification groups', async () => {
    await deleteNotificationStoreItem('n1');
    await deleteVentaNotificationsStoreWorkflow('v1');
    expect(mocks.deleteNotification).toHaveBeenCalledWith('n1');
    expect(mocks.deleteByVenta).toHaveBeenCalledWith('v1');
    expect(mocks.invalidate).toHaveBeenCalledTimes(2);
  });

  it('refreshes active query caches and flattens payment snapshots', () => {
    const client = {
      invalidateQueries: vi.fn(),
      getQueriesData: vi.fn().mockReturnValue([
        [['metodos-pago'], [{ id: 'm1' }]],
        [['metodos-pago', 'detail'], { id: 'ignored' }],
        [['metodos-pago', 'list'], [{ id: 'm2' }]],
      ]),
    };
    mocks.getClient.mockReturnValue(client);
    refreshVentasStoreCache();
    expect(client.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(getCurrentMetodosPagoStoreSnapshot()).toEqual([{ id: 'm1' }, { id: 'm2' }]);
  });

  it('handles absent active query client safely', () => {
    mocks.getClient.mockReturnValue(null);
    refreshVentasStoreCache();
    expect(getCurrentMetodosPagoStoreSnapshot()).toEqual([]);
  });
});
