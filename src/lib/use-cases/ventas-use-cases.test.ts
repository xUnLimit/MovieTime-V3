import { beforeEach, describe, expect, it, vi } from 'vitest';

const ventasRepository = vi.hoisted(() => ({
  adjustCategoriaSuscripciones: vi.fn(),
  adjustServiciosActivos: vi.fn(),
  createVenta: vi.fn(),
  createVentaWithInitialPayment: vi.fn(),
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
  adjustIngresosStats: vi.fn(),
  getDiaKeyFromDate: vi.fn(() => '2026-05-10'),
  getMesKeyFromDate: vi.fn(() => '2026-05'),
  upsertVentaPronostico: vi.fn(),
}));

const currencyService = vi.hoisted(() => ({
  convertToUSD: vi.fn(),
}));

const notificationSyncService = vi.hoisted(() => ({
  sincronizarUnaVenta: vi.fn(),
}));

const pagosVentaService = vi.hoisted(() => ({
  crearPagoRenovacion: vi.fn(),
}));

const ventaSyncService = vi.hoisted(() => ({
  getVentaConUltimoPago: vi.fn(),
}));

const usuarioMetodoPagoSyncService = vi.hoisted(() => ({
  syncUsuarioMetodoPago: vi.fn(),
}));

vi.mock('@/lib/supabase/ventas-repository', () => ventasRepository);
vi.mock('@/lib/services/dashboardStatsService', () => dashboardStatsService);
vi.mock('@/lib/services/currencyService', () => ({
  currencyService,
}));
vi.mock('@/lib/services/notificationSyncService', () => notificationSyncService);
vi.mock('@/lib/services/pagosVentaService', () => pagosVentaService);
vi.mock('@/lib/services/ventaSyncService', () => ventaSyncService);
vi.mock('@/lib/services/usuarioMetodoPagoSyncService', () => usuarioMetodoPagoSyncService);
vi.mock('@/lib/supabase/catalogos-repository', () => ({
  getMetodoPagoById: vi.fn(),
}));

import {
  createVentaUseCase,
  deleteVentaUseCase,
  toVentaPronostico,
  updateVentaUseCase,
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
    currencyService.convertToUSD.mockImplementation(async (amount: number) => amount);
    dashboardStatsService.adjustIngresosStats.mockResolvedValue(undefined);
    dashboardStatsService.upsertVentaPronostico.mockResolvedValue(undefined);
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
    }));
    expect(ventasRepository.createVenta).not.toHaveBeenCalled();
    expect(ventasRepository.adjustServiciosActivos).toHaveBeenCalledWith(ventaBase.clienteId, 1);
    expect(recordActivityLog).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'creacion',
      entidad: 'venta',
      entidadId: 'venta-nueva',
    }));
    expect(result.venta.id).toBe('venta-nueva');
  });

  it('updates active counters and returns a profile delta when suspending a venta', async () => {
    const recordActivityLog = vi.fn();

    const result = await updateVentaUseCase(ventaBase.id, { estado: 'inactivo' }, {
      currentVenta: ventaBase,
      logContext,
      recordActivityLog,
    });

    expect(ventasRepository.updateVenta).toHaveBeenCalledWith(ventaBase.id, { estado: 'inactivo' });
    expect(ventasRepository.adjustServiciosActivos).toHaveBeenCalledWith(ventaBase.clienteId, -1);
    expect(ventasRepository.adjustCategoriaSuscripciones).toHaveBeenCalledWith(ventaBase.categoriaId, -1, -10);
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
    expect(ventasRepository.adjustServiciosActivos).toHaveBeenCalledWith(ventaBase.clienteId, -1);
    expect(dashboardStatsService.upsertVentaPronostico).toHaveBeenCalledWith(null, ventaBase.id);
    expect(result.serviceProfileDelta).toEqual({
      servicioId: ventaBase.servicioId,
      shouldIncrement: false,
    });
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
