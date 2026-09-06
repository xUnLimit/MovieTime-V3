import { beforeEach, describe, expect, it, vi } from 'vitest';

const domainReadAdapters = vi.hoisted(() => ({
  getCategoriaPlanesRead: vi.fn(),
  getServicioRead: vi.fn(),
  getServicioTipoRead: vi.fn(),
  queryMetodosPagoServiciosRead: vi.fn(),
  queryMetodosPagoTercerosRead: vi.fn(),
}));

const servicioPayments = vi.hoisted(() => ({
  renewServicioUseCase: vi.fn(),
}));

const ventaPayments = vi.hoisted(() => ({
  renewVentaUseCase: vi.fn(),
}));

const workflowReactions = vi.hoisted(() => ({
  deleteServicioNotificationsStoreWorkflow: vi.fn(),
  deleteVentaNotificationsStoreWorkflow: vi.fn(),
  getCurrentMetodosPagoStoreSnapshot: vi.fn(),
  refreshVentasStoreCache: vi.fn(),
}));

const forecasting = vi.hoisted(() => ({
  syncVentaForecastReadModels: vi.fn(),
}));
const notifications = vi.hoisted(() => ({ sincronizarUnServicio: vi.fn() }));
vi.mock('@/modules/notifications', () => notifications);

vi.mock('@/platform/supabase/domain-read-adapters', () => domainReadAdapters);
vi.mock('@/application/use-cases/servicios/servicios-payment-use-cases', () => servicioPayments);
vi.mock('@/application/use-cases/ventas/ventas-payment-use-cases', () => ventaPayments);
vi.mock('@/application/store-reactions/notificaciones-workflow-reactions', () => workflowReactions);
vi.mock('@/modules/forecasting', () => forecasting);
vi.mock('@/platform/activity/activity-log-adapter', () => ({
  getActivityLogOptions: vi.fn(() => ({ logContext: { usuarioId: 'u1' } })),
}));

import {
  confirmServicioRenewalFromNotificationUseCase,
  confirmVentaRenewalFromNotificationUseCase,
  loadVentaRenewalOptionsUseCase,
} from './notificaciones-renewal-use-cases';
import type { ActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import type { MetodoPago, NotificacionVenta, Servicio } from '@/types';

const testLog = {
  logContext: { usuarioId: 'u1', usuarioEmail: 'u@test.com' },
  recordActivityLog: vi.fn(),
} as unknown as ActivityLogOptions;

const ventaNotification = {
  id: 'notif-1',
  ventaId: 'venta-1',
  clienteId: 'cliente-1',
  clienteNombre: 'Ana',
  clienteTelefono: '+507 6000-0000',
  categoriaId: 'cat-1',
  servicioId: 'servicio-1',
  servicioNombre: 'Netflix',
  precioFinal: 12,
  moneda: 'USD',
  cicloPago: 'mensual',
} as NotificacionVenta & { id: string };

describe('notificaciones renewal use-cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowReactions.getCurrentMetodosPagoStoreSnapshot.mockReturnValue([
      { id: 'metodo-1', nombre: 'Tarjeta', moneda: 'USD' },
    ]);
  });

  it('loads venta renewal options without UI dependencies', async () => {
    domainReadAdapters.queryMetodosPagoTercerosRead.mockResolvedValue([
      { id: 'metodo-1', nombre: 'Tarjeta' },
    ]);
    domainReadAdapters.getCategoriaPlanesRead.mockResolvedValue([{ id: 'plan-1' }]);
    domainReadAdapters.getServicioTipoRead.mockResolvedValue('pantalla');

    const options = await loadVentaRenewalOptionsUseCase(ventaNotification);

    expect(options).toMatchObject({
      categoriaPlanes: [{ id: 'plan-1' }],
      servicioTipoSeleccionado: 'pantalla',
    });
    expect(options.metodosPagoTerceros).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'metodo-1' })]),
    );
  });

  it('renews a venta notification and returns UI/cache outcomes', async () => {
    ventaPayments.renewVentaUseCase.mockResolvedValue({
      monto: 12,
      pronostico: { ventaId: 'venta-1' },
      syncPaymentMethodFailed: true,
    });
    workflowReactions.deleteVentaNotificationsStoreWorkflow.mockResolvedValue(undefined);
    const refreshNotificationCaches = vi.fn().mockResolvedValue(undefined);

    const outcome = await confirmVentaRenewalFromNotificationUseCase({
      data: {
        metodoPagoId: 'metodo-1',
        mensajeWhatsApp: 'Pago renovado',
        notificarWhatsApp: true,
      },
      log: testLog,
      notif: ventaNotification,
      refreshNotificationCaches,
    });

    expect(outcome).toEqual({
      renewed: true,
      warnings: ['sync_payment_method_failed'],
      cacheInvalidations: [{ entity: 'venta', entityId: 'venta-1' }],
      notificationInvalidationNeeded: true,
      storeRefreshes: ['ventas', 'notificaciones'],
      whatsappMessage: {
        phone: '+50760000000',
        message: 'Pago renovado',
      },
    });
    expect(ventaPayments.renewVentaUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'venta-1' }),
      expect.objectContaining({ metodoPagoNombre: 'Tarjeta', moneda: 'USD' }),
      expect.any(Object),
    );
    expect(refreshNotificationCaches).toHaveBeenCalledTimes(1);
    expect(workflowReactions.refreshVentasStoreCache).toHaveBeenCalledTimes(1);
    expect(forecasting.syncVentaForecastReadModels).toHaveBeenCalledWith('venta-1');
  });

  it('renews a servicio notification and returns invalidation targets', async () => {
    const servicio = {
      id: 'servicio-1',
      nombre: 'Netflix',
      cicloPago: 'mensual',
      costoServicio: 20,
      fechaInicio: new Date('2026-05-01T00:00:00.000Z'),
      fechaVencimiento: new Date('2026-06-01T00:00:00.000Z'),
      moneda: 'USD',
    } as Servicio;
    const metodosPago = [{ id: 'metodo-1', nombre: 'Tarjeta' }] as MetodoPago[];
    servicioPayments.renewServicioUseCase.mockResolvedValue({ servicioActualizado: servicio });
    const refreshNotificationCaches = vi.fn().mockResolvedValue(undefined);

    const outcome = await confirmServicioRenewalFromNotificationUseCase({
      data: { metodoPagoId: 'metodo-1' },
      log: testLog,
      metodosPagoServicio: metodosPago,
      refreshNotificationCaches,
      servicio,
    });

    expect(outcome).toEqual({
      renewed: true,
      warnings: [],
      cacheInvalidations: [{ entity: 'servicio', entityId: 'servicio-1' }],
      notificationInvalidationNeeded: true,
      storeRefreshes: ['servicios', 'notificaciones', 'categorias'],
    });
    expect(servicioPayments.renewServicioUseCase).toHaveBeenCalledWith(
      servicio,
      expect.objectContaining({ costo: 20, metodoPagoId: 'metodo-1' }),
      expect.objectContaining({ metodoPago: metodosPago[0] }),
    );
    expect(notifications.sincronizarUnServicio).toHaveBeenCalledWith('servicio-1');
    expect(workflowReactions.deleteServicioNotificationsStoreWorkflow).not.toHaveBeenCalled();
  });
});
