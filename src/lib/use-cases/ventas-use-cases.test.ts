import { beforeEach, describe, expect, it, vi } from 'vitest';

const ventasRepository = vi.hoisted(() => ({
  createVenta: vi.fn(),
  createVentaWithInitialPayment: vi.fn(),
  createVentaRefund: vi.fn(),
  getPagoVentaById: vi.fn(),
  getVentaById: vi.fn(),
  countVentas: vi.fn(),
  queryPagosVenta: vi.fn(),
  queryVentas: vi.fn(),
  removePagoVenta: vi.fn(),
  removeVenta: vi.fn(),
  removeVentaWithPayments: vi.fn(),
  updateLatestVentaPeriodo: vi.fn(),
  updateVenta: vi.fn(),
  updateVentaPaymentAndPeriod: vi.fn(),
}));

const dashboardStatsService = vi.hoisted(() => ({
  getDiaKeyFromDate: vi.fn(() => '2026-05-10'),
  getMesKeyFromDate: vi.fn(() => '2026-05'),
}));

const paymentsModule = vi.hoisted(() => ({
  convertToUSD: vi.fn(),
  createRenewalVentaPayment: vi.fn(),
}));

const notificationSyncService = vi.hoisted(() => ({
  sincronizarUnaVenta: vi.fn(),
}));

const ventaSyncService = vi.hoisted(() => ({
  getVentaConUltimoPago: vi.fn(),
}));

const terceroMetodoPagoSyncService = vi.hoisted(() => ({
  syncTerceroMetodoPago: vi.fn(),
}));

vi.mock('@/lib/supabase/ventas-repository', () => ventasRepository);
vi.mock('@/lib/services/dashboardStatsService', () => dashboardStatsService);
vi.mock('@/lib/payments', () => paymentsModule);
vi.mock('@/lib/notifications', () => notificationSyncService);
vi.mock('@/lib/services/ventaSyncService', () => ventaSyncService);
vi.mock('@/lib/services/terceroMetodoPagoSyncService', () => terceroMetodoPagoSyncService);
vi.mock('@/lib/supabase/catalogos-repository', () => ({
  getMetodoPagoById: vi.fn(),
}));

import {
  createVentaUseCase,
  deleteVentaUseCase,
  renewVentaUseCase,
  updateVentaUseCase,
  updateVentaWithLatestPagoUseCase,
} from './ventas-use-cases';
import type { VentaDoc } from '@/types';

const logContext = {
  usuarioId: '00000000-0000-4000-8000-000000000001',
  usuarioEmail: 'admin@example.com',
};

const ventaBase: VentaDoc = {
  id: '00000000-0000-4000-8000-000000000010',
  clienteId: '00000000-0000-4000-8000-000000000011',
  clienteNombre: 'Cliente Uno',
  servicioId: '00000000-0000-4000-8000-000000000012',
  servicioNombre: 'Netflix',
  categoriaId: '00000000-0000-4000-8000-000000000013',
  categoriaNombre: 'Streaming',
  planId: '00000000-0000-4000-8000-000000000014',
  planNombre: 'Mensual',
  planTipoNombre: 'Individual',
  estado: 'activo',
  precio: 12,
  precioFinal: 10,
  moneda: 'USD',
  cicloPago: 'mensual',
  fechaInicio: new Date('2026-05-01T00:00:00.000Z'),
  fechaFin: new Date('2026-06-01T00:00:00.000Z'),
};

describe('ventas use cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentsModule.convertToUSD.mockImplementation(async (amount: number) => amount);
    paymentsModule.createRenewalVentaPayment.mockResolvedValue('pago-renovacion');
    notificationSyncService.sincronizarUnaVenta.mockResolvedValue(undefined);
  });

  it('creates a venta through the atomic initial-payment RPC when a payment is present', async () => {
    ventasRepository.createVentaWithInitialPayment.mockResolvedValueOnce('venta-nueva');
    const recordActivityLog = vi.fn();

    const result = await createVentaUseCase({
      ...ventaBase,
      id: undefined as never,
      pagos: [{ fecha: new Date('2026-05-01T12:00:00.000Z'), total: 10, notas: 'Pago inicial' }],
    }, {
      logContext,
      recordActivityLog,
    });

    expect(ventasRepository.createVentaWithInitialPayment).toHaveBeenCalledWith(expect.objectContaining({
      p_cliente_id: ventaBase.clienteId,
      p_servicio_id: ventaBase.servicioId,
      p_total_original: 10,
      p_total_usd: 10,
      p_pago_notas: 'Pago inicial',
      p_plan_id: ventaBase.planId,
      p_plan_nombre_snapshot: ventaBase.planNombre,
      p_plan_tipo_nombre_snapshot: ventaBase.planTipoNombre,
    }));
    expect(ventasRepository.createVenta).not.toHaveBeenCalled();
    expect(recordActivityLog).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'creacion',
      entidad: 'venta',
      entidadId: 'venta-nueva',
    }));
    expect(result.venta.id).toBe('venta-nueva');
  });

  it('rejects creating a venta when the selected plan data is missing', async () => {
    await expect(createVentaUseCase({
      ...ventaBase,
      id: undefined as never,
      planId: undefined,
      pagos: [{ fecha: new Date('2026-05-01T12:00:00.000Z'), total: 10 }],
    }, {
      logContext,
    })).rejects.toThrow('Una venta debe tener un plan seleccionado.');

    expect(ventasRepository.createVentaWithInitialPayment).not.toHaveBeenCalled();
    expect(ventasRepository.createVenta).not.toHaveBeenCalled();
  });

  it('passes plan data when renewing a venta', async () => {
    paymentsModule.createRenewalVentaPayment.mockResolvedValueOnce('pago-renovacion');

    await renewVentaUseCase(ventaBase, {
      periodoRenovacion: 'mensual',
      metodoPagoId: '00000000-0000-4000-8000-000000000015',
      metodoPagoNombre: 'Zelle',
      moneda: 'USD',
      costo: 12,
      descuento: 0,
      fechaInicio: new Date('2026-06-01T00:00:00.000Z'),
      fechaVencimiento: new Date('2026-07-01T00:00:00.000Z'),
      planId: ventaBase.planId,
      planNombre: ventaBase.planNombre,
      planTipoNombre: ventaBase.planTipoNombre,
    });

    expect(paymentsModule.createRenewalVentaPayment).toHaveBeenCalledWith(
      ventaBase.id,
      ventaBase.clienteId,
      ventaBase.clienteNombre,
      ventaBase.categoriaId,
      12,
      'Zelle',
      '00000000-0000-4000-8000-000000000015',
      'USD',
      'mensual',
      '',
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-07-01T00:00:00.000Z'),
      12,
      0,
      ventaBase.planId,
      ventaBase.planNombre,
      ventaBase.planTipoNombre
    );
  });

  it('returns syncPaymentMethodFailed when renewing a venta cannot sync the tercero payment method', async () => {
    paymentsModule.createRenewalVentaPayment.mockResolvedValueOnce('pago-renovacion');
    terceroMetodoPagoSyncService.syncTerceroMetodoPago.mockRejectedValueOnce(new Error('sync failed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await renewVentaUseCase(ventaBase, {
      periodoRenovacion: 'mensual',
      metodoPagoId: '00000000-0000-4000-8000-000000000015',
      metodoPagoNombre: 'Zelle',
      moneda: 'USD',
      costo: 12,
      descuento: 0,
      fechaInicio: new Date('2026-06-01T00:00:00.000Z'),
      fechaVencimiento: new Date('2026-07-01T00:00:00.000Z'),
      planId: ventaBase.planId,
      planNombre: ventaBase.planNombre,
      planTipoNombre: ventaBase.planTipoNombre,
    });

    expect(result.syncPaymentMethodFailed).toBe(true);
    expect(paymentsModule.createRenewalVentaPayment).toHaveBeenCalled();
    expect(ventasRepository.updateVenta).toHaveBeenCalledWith(ventaBase.id, { notas: '' });

    consoleErrorSpy.mockRestore();
  });

  it('rejects renewing a venta when the selected plan data is missing', async () => {
    await expect(renewVentaUseCase({
      ...ventaBase,
      planId: undefined,
      planNombre: undefined,
    }, {
      periodoRenovacion: 'mensual',
      metodoPagoId: '00000000-0000-4000-8000-000000000015',
      metodoPagoNombre: 'Zelle',
      moneda: 'USD',
      costo: 12,
      fechaInicio: new Date('2026-06-01T00:00:00.000Z'),
      fechaVencimiento: new Date('2026-07-01T00:00:00.000Z'),
    })).rejects.toThrow('Una renovación debe tener un plan seleccionado.');

    expect(paymentsModule.createRenewalVentaPayment).not.toHaveBeenCalled();
  });

  it('returns a profile delta when suspending a venta', async () => {
    const recordActivityLog = vi.fn();

    const result = await updateVentaUseCase(ventaBase.id, { estado: 'inactivo' }, {
      currentVenta: ventaBase,
      logContext,
      recordActivityLog,
    });

    expect(ventasRepository.updateVenta).toHaveBeenCalledWith(ventaBase.id, { estado: 'inactivo' });
    expect(recordActivityLog).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'corte',
      entidad: 'venta',
      entidadId: ventaBase.id,
    }));
    expect(result.serviceProfileDelta).toEqual({
      servicioId: ventaBase.servicioId,
      shouldIncrement: false,
    });
    expect(result.pronostico).toBeNull();
  });

  it('passes plan data when editing the latest venta payment period', async () => {
    ventasRepository.queryPagosVenta.mockResolvedValueOnce([{
      id: 'pago-actual',
      ventaId: ventaBase.id,
      fecha: new Date('2026-05-01T00:00:00.000Z'),
    }]);

    await updateVentaWithLatestPagoUseCase(
      ventaBase.id,
      { notas: 'Actualizada' },
      {
        precio: 12,
        descuento: 0,
        monto: 12,
        metodoPagoId: '00000000-0000-4000-8000-000000000015',
        metodoPago: 'Zelle',
        moneda: 'USD',
        cicloPago: 'mensual',
        fechaInicio: new Date('2026-05-01T00:00:00.000Z'),
        fechaVencimiento: new Date('2026-06-01T00:00:00.000Z'),
        planId: ventaBase.planId,
        planNombre: ventaBase.planNombre,
        planTipoNombre: ventaBase.planTipoNombre,
      },
      {
        currentVenta: ventaBase,
        logContext,
      }
    );

    expect(ventasRepository.updateVentaPaymentAndPeriod).toHaveBeenCalledWith('pago-actual', expect.objectContaining({
      planId: ventaBase.planId,
      planNombre: ventaBase.planNombre,
      planTipoNombre: ventaBase.planTipoNombre,
    }));
  });

  it('deletes a venta through the delete-with-payments RPC when requested', async () => {
    const recordActivityLog = vi.fn();

    const result = await deleteVentaUseCase(ventaBase.id, {
      venta: ventaBase,
      servicioId: ventaBase.servicioId,
      perfilNumero: 1,
      deletePagos: true,
      logContext,
      recordActivityLog,
    });

    expect(ventasRepository.removeVentaWithPayments).toHaveBeenCalledWith(ventaBase.id, true);
    expect(ventasRepository.removeVenta).not.toHaveBeenCalled();
    expect(result.serviceProfileDelta).toEqual({
      servicioId: ventaBase.servicioId,
      shouldIncrement: false,
    });
  });
});
