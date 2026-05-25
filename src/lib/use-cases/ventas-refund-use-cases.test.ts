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
vi.mock('@/lib/dashboard-read-models', () => dashboardStatsService);
vi.mock('@/lib/payments', () => paymentsModule);
vi.mock('@/lib/notifications', () => notificationSyncService);
vi.mock('@/lib/services/ventaSyncService', () => ventaSyncService);
vi.mock('@/lib/services/terceroMetodoPagoSyncService', () => terceroMetodoPagoSyncService);
vi.mock('@/lib/supabase/catalogos-repository', () => ({
  getMetodoPagoById: vi.fn(),
}));

import { createVentaRefundUseCase } from './ventas/ventas-refund-use-cases';
import { toVentaPronostico } from './ventas/ventas-shared';
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

describe('ventas refund use cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentsModule.convertToUSD.mockImplementation(async (amount: number) => amount);
    notificationSyncService.sincronizarUnaVenta.mockResolvedValue(undefined);
  });

  it('creates a valid refund and returns a profile delta when cutting the venta', async () => {
    ventasRepository.queryPagosVenta.mockResolvedValueOnce([
      {
        id: 'pago-1',
        ventaId: ventaBase.id,
        monto: 10,
        estado: 'registrado',
      },
    ]);
    ventasRepository.createVentaRefund.mockResolvedValueOnce('pago-reembolso');
    ventasRepository.getVentaById.mockResolvedValueOnce(ventaBase);
    ventaSyncService.getVentaConUltimoPago.mockResolvedValueOnce({
      ...ventaBase,
      estado: 'inactivo',
    });
    const recordActivityLog = vi.fn();

    const result = await createVentaRefundUseCase(ventaBase, {
      ventaId: ventaBase.id,
      monto: 5,
      metodoPagoId: '00000000-0000-4000-8000-000000000015',
      metodoPagoNombre: 'Zelle',
      moneda: 'USD',
      fecha: new Date('2026-05-15T00:00:00.000Z'),
      nota: 'Reembolso parcial',
      destinoReembolso: 'Banco General 123',
      cortarServicio: true,
      motivoCorte: 'Cliente solicito corte',
    }, {
      logContext,
      recordActivityLog,
    });

    expect(ventasRepository.createVentaRefund).toHaveBeenCalledWith(expect.objectContaining({
      p_venta_id: ventaBase.id,
      p_monto_original: 5,
      p_monto_usd: 5,
      p_destino_reembolso: 'Banco General 123',
      p_cortar: true,
      p_motivo_corte: 'Cliente solicito corte',
    }));
    expect(recordActivityLog).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'reembolso',
      entidad: 'venta',
      entidadId: ventaBase.id,
    }));
    expect(result).toEqual(expect.objectContaining({
      pagoId: 'pago-reembolso',
      monto: 5,
      montoUsd: 5,
      serviceProfileDelta: {
        servicioId: ventaBase.servicioId,
        shouldIncrement: false,
      },
    }));
  });

  it('rejects a refund that exceeds the available paid balance', async () => {
    ventasRepository.queryPagosVenta.mockResolvedValueOnce([
      {
        id: 'pago-1',
        ventaId: ventaBase.id,
        monto: 5,
        estado: 'registrado',
      },
    ]);

    await expect(createVentaRefundUseCase(ventaBase, {
      ventaId: ventaBase.id,
      monto: 6,
      metodoPagoId: '00000000-0000-4000-8000-000000000015',
      metodoPagoNombre: 'Zelle',
      moneda: 'USD',
      fecha: new Date('2026-05-15T00:00:00.000Z'),
      destinoReembolso: 'Banco General 123',
      cortarServicio: false,
    }, {
      logContext,
    })).rejects.toThrow('El reembolso supera el saldo disponible de la venta.');

    expect(ventasRepository.createVentaRefund).not.toHaveBeenCalled();
  });

  it('does not create a forecast for inactive or zero-priced ventas', () => {
    expect(toVentaPronostico({ ...ventaBase, estado: 'inactivo' })).toBeNull();
    expect(toVentaPronostico({ ...ventaBase, precioFinal: 0 })).toBeNull();
    expect(toVentaPronostico(ventaBase)).toEqual(expect.objectContaining({
      id: ventaBase.id,
      categoriaId: ventaBase.categoriaId,
      cicloPago: 'mensual',
      precioFinal: 10,
      moneda: 'USD',
    }));
  });
});
