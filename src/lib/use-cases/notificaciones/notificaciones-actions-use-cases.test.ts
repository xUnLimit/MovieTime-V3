import { beforeEach, describe, expect, it, vi } from 'vitest';

const workflow = vi.hoisted(() => ({
  cutVentaFromNotificationStoreWorkflow: vi.fn(),
  inactivateServicioFromNotificationStoreWorkflow: vi.fn(),
  refreshVentasStoreCache: vi.fn(),
}));

vi.mock('@/lib/store-reactions/notificaciones-workflow-reactions', () => workflow);

import {
  cutVentaFromNotificationUseCase,
  inactivateServicioFromNotificationUseCase,
} from './notificaciones-actions-use-cases';

describe('notificaciones action use-cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflow.cutVentaFromNotificationStoreWorkflow.mockResolvedValue(undefined);
    workflow.inactivateServicioFromNotificationStoreWorkflow.mockResolvedValue(undefined);
  });

  it('cuts a venta through the notification workflow seam', async () => {
    const refreshNotificationCaches = vi.fn().mockResolvedValue(undefined);

    await expect(
      cutVentaFromNotificationUseCase({
        motivoCorte: 'Sin pago',
        refreshNotificationCaches,
        ventaId: 'venta-1',
      }),
    ).resolves.toEqual({
      completed: true,
      cacheInvalidations: [{ entity: 'venta', entityId: 'venta-1' }],
      notificationInvalidationNeeded: true,
      storeRefreshes: ['ventas', 'notificaciones'],
    });

    expect(workflow.cutVentaFromNotificationStoreWorkflow).toHaveBeenCalledWith('venta-1', 'Sin pago');
    expect(refreshNotificationCaches).toHaveBeenCalledTimes(1);
    expect(workflow.refreshVentasStoreCache).toHaveBeenCalledTimes(1);
  });

  it('inactivates a servicio through the notification workflow seam', async () => {
    const refreshNotificationCaches = vi.fn().mockResolvedValue(undefined);

    await expect(
      inactivateServicioFromNotificationUseCase({
        refreshNotificationCaches,
        servicioId: 'servicio-1',
        servicioNombre: 'Netflix',
      }),
    ).resolves.toEqual({
      completed: true,
      cacheInvalidations: [{ entity: 'servicio', entityId: 'servicio-1' }],
      notificationInvalidationNeeded: true,
      storeRefreshes: ['servicios', 'notificaciones'],
    });

    expect(workflow.inactivateServicioFromNotificationStoreWorkflow).toHaveBeenCalledWith('servicio-1');
    expect(refreshNotificationCaches).toHaveBeenCalledTimes(1);
  });
});
