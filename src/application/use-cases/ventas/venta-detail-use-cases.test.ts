import { beforeEach, describe, expect, it, vi } from 'vitest';

const domainReadAdapters = vi.hoisted(() => ({
  getCategoriaPlanesRead: vi.fn(),
  getServicioContrasenaRead: vi.fn(),
  getVentaDetalleRead: vi.fn(),
  queryMetodosPagoTercerosRead: vi.fn(),
}));

const ventaCurrentPayment = vi.hoisted(() => ({
  getVentaConUltimoPagoUseCase: vi.fn(),
}));

const ventaPayments = vi.hoisted(() => ({
  deleteVentaPagoUseCase: vi.fn(),
  renewVentaUseCase: vi.fn(),
  updateVentaPagoUseCase: vi.fn(),
}));

const ventaRefunds = vi.hoisted(() => ({
  createVentaRefundUseCase: vi.fn(),
}));

const clientCache = vi.hoisted(() => ({
  invalidateDashboardCache: vi.fn(),
}));

const forecasting = vi.hoisted(() => ({
  syncVentaForecastReadModels: vi.fn(),
}));

const cacheReactions = vi.hoisted(() => ({
  emitVentaUpdated: vi.fn(),
}));

vi.mock('@/platform/supabase/domain-read-adapters', () => domainReadAdapters);
vi.mock('@/application/use-cases/ventas/venta-current-payment-use-cases', () => ventaCurrentPayment);
vi.mock('@/application/use-cases/ventas/ventas-payment-use-cases', () => ventaPayments);
vi.mock('@/application/use-cases/ventas/ventas-refund-use-cases', () => ventaRefunds);
vi.mock('@/platform/commands/client-cache', () => clientCache);
vi.mock('@/modules/forecasting', () => forecasting);
vi.mock('@/platform/events/cache-reactions', () => cacheReactions);
vi.mock('@/application/activity/activity-log-writer', () => ({
  getActivityLogOptions: vi.fn(() => ({ logContext: { usuarioId: 'u1', usuarioEmail: 'u@test.com' } })),
}));

import {
  deleteVentaDetalleWorkflow,
  deleteVentaPagoDetalleWorkflow,
  refundVentaDetalleWorkflow,
  renewVentaDetalleWorkflow,
  updateVentaPagoDetalleWorkflow,
} from './venta-detail-use-cases';
import type { ActivityLogOptions } from '@/application/activity/activity-log-writer';
import type { MetodoPago, VentaDoc } from '@/types';

const testLog = {
  logContext: { usuarioId: 'u1', usuarioEmail: 'u@test.com' },
  recordActivityLog: vi.fn(),
} as unknown as ActivityLogOptions;

const venta = {
  id: 'venta-1',
  clienteId: 'cliente-1',
  clienteNombre: 'Cliente Uno',
  servicioId: 'servicio-1',
  servicioNombre: 'Netflix',
  categoriaId: 'categoria-1',
  metodoPagoNombre: 'Yappy',
  moneda: 'USD',
  precioFinal: 10,
  fechaInicio: new Date('2026-05-01T00:00:00.000Z'),
  fechaFin: new Date('2026-06-01T00:00:00.000Z'),
} as VentaDoc;

describe('venta detail workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    domainReadAdapters.getVentaDetalleRead.mockResolvedValue(venta);
    domainReadAdapters.getServicioContrasenaRead.mockResolvedValue('secret');
    ventaCurrentPayment.getVentaConUltimoPagoUseCase.mockResolvedValue(venta);
  });

  it('deletes a venta through the injected dependency and returns the outcome', async () => {
    const deps = {
      deleteVenta: vi.fn().mockResolvedValue(undefined),
    };

    const outcome = await deleteVentaDetalleWorkflow({
      deps,
      deletePagos: true,
      venta,
    });

    expect(outcome).toEqual({ type: 'ventaDeleted', deletedPayments: true });
    expect(deps.deleteVenta).toHaveBeenCalledWith('venta-1', 'servicio-1', venta.perfilNumero, true);
  });

  it('renews a venta and returns an explicit outcome', async () => {
    const deps = {
      deleteNotificacionesPorVenta: vi.fn().mockResolvedValue(undefined),
      invalidateNotifications: vi.fn().mockResolvedValue(undefined),
      refreshPagos: vi.fn(),
    };
    const metodosPago = [{ id: 'metodo-1', nombre: 'Tarjeta', moneda: 'COP' }] as MetodoPago[];
    ventaPayments.renewVentaUseCase.mockResolvedValue({
      monto: 15,
      pronostico: { id: 'venta-1' },
      syncPaymentMethodFailed: true,
    });

    const outcome = await renewVentaDetalleWorkflow({
      deps,
      id: 'venta-1',
      input: {
        costo: 15,
        metodoPagoId: 'metodo-1',
        periodoRenovacion: 'mensual',
        fechaInicio: new Date('2026-06-01T00:00:00.000Z'),
        fechaVencimiento: new Date('2026-07-01T00:00:00.000Z'),
        notificarWhatsApp: true,
      },
      log: testLog,
      metodosPago,
      venta,
    });

    expect(outcome).toMatchObject({
      type: 'ventaRenewed',
      monto: 15,
      syncPaymentMethodFailed: true,
      whatsappRequested: true,
    });
    expect(ventaPayments.renewVentaUseCase).toHaveBeenCalledWith(
      venta,
      expect.objectContaining({ metodoPagoNombre: 'Tarjeta', moneda: 'COP' }),
      expect.any(Object),
    );
    expect(deps.deleteNotificacionesPorVenta).toHaveBeenCalledWith('venta-1');
    expect(deps.invalidateNotifications).toHaveBeenCalledTimes(1);
    expect(cacheReactions.emitVentaUpdated).toHaveBeenCalledWith('venta-1');
  });

  it('refunds and cuts a venta while updating service profile through the seam', async () => {
    const deps = {
      deleteNotificacionesPorVenta: vi.fn().mockResolvedValue(undefined),
      invalidateNotifications: vi.fn().mockResolvedValue(undefined),
      refreshPagos: vi.fn(),
      updatePerfilOcupado: vi.fn().mockResolvedValue(undefined),
    };
    ventaRefunds.createVentaRefundUseCase.mockResolvedValue({
      serviceProfileDelta: { servicioId: 'servicio-1', shouldIncrement: false },
      ventaActualizada: { ...venta, estado: 'inactivo' },
      pronostico: { id: 'venta-1' },
    });

    const outcome = await refundVentaDetalleWorkflow({
      deps,
      id: 'venta-1',
      input: {
        monto: 5,
        metodoPagoId: 'metodo-1',
        destinoReembolso: 'cliente',
        fecha: new Date('2026-05-15T00:00:00.000Z'),
        cortarServicio: true,
        motivoCorte: 'Solicitud del cliente',
      },
      log: testLog,
      venta,
    });

    expect(outcome).toMatchObject({ type: 'ventaRefunded', cut: true });
    expect(deps.updatePerfilOcupado).toHaveBeenCalledWith('servicio-1', false);
    expect(deps.deleteNotificacionesPorVenta).toHaveBeenCalledWith('venta-1');
    expect(deps.invalidateNotifications).toHaveBeenCalledTimes(1);
  });

  it('updates a venta payment and returns refreshed venta data', async () => {
    ventaPayments.updateVentaPagoUseCase.mockResolvedValue({ syncPaymentMethodFailed: false });
    const updatedVenta = { ...venta, precioFinal: 18 };
    domainReadAdapters.getVentaDetalleRead.mockResolvedValue(updatedVenta);
    ventaCurrentPayment.getVentaConUltimoPagoUseCase.mockResolvedValue(updatedVenta);

    const outcome = await updateVentaPagoDetalleWorkflow({
      id: 'venta-1',
      input: {
        costo: 18,
        metodoPagoId: 'metodo-1',
        periodoRenovacion: 'mensual',
        fechaInicio: new Date('2026-06-01T00:00:00.000Z'),
        fechaVencimiento: new Date('2026-07-01T00:00:00.000Z'),
      },
      metodosPago: [{ id: 'metodo-1', nombre: 'Tarjeta', moneda: 'COP' }] as MetodoPago[],
      pagoId: 'pago-1',
      venta,
    });

    expect(outcome).toEqual({
      type: 'ventaPaymentUpdated',
      syncPaymentMethodFailed: false,
      ventaActualizada: updatedVenta,
    });
    expect(ventaPayments.updateVentaPagoUseCase).toHaveBeenCalledWith(
      venta,
      'pago-1',
      expect.objectContaining({ metodoPagoNombre: 'Tarjeta', moneda: 'COP' }),
    );
  });

  it('deletes a venta payment and normalizes an empty refreshed venta to null', async () => {
    ventaPayments.deleteVentaPagoUseCase.mockResolvedValue({ ventaActualizada: undefined });

    const outcome = await deleteVentaPagoDetalleWorkflow({
      id: 'venta-1',
      pagoId: 'pago-1',
    });

    expect(outcome).toEqual({ type: 'ventaPaymentDeleted', ventaActualizada: null });
    expect(ventaPayments.deleteVentaPagoUseCase).toHaveBeenCalledWith('venta-1', 'pago-1');
  });
});
