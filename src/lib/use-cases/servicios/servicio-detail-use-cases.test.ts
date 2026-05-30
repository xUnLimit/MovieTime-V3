import { beforeEach, describe, expect, it, vi } from 'vitest';

const domainReadAdapters = vi.hoisted(() => ({
  getMetodoPagoRead: vi.fn(),
  getServicioRead: vi.fn(),
  getVentaDetalleRead: vi.fn(),
}));

const ventasRepository = vi.hoisted(() => ({
  getVentaById: vi.fn(),
  queryVentas: vi.fn(),
}));

const servicioPayments = vi.hoisted(() => ({
  deleteServicioPagoUseCase: vi.fn(),
  renewServicioUseCase: vi.fn(),
  updateServicioPagoUseCase: vi.fn(),
}));

const ventasWrite = vi.hoisted(() => ({
  updateVentaUseCase: vi.fn(),
}));

const tercerosUseCases = vi.hoisted(() => ({
  getTerceroUseCase: vi.fn(),
}));

const clientCache = vi.hoisted(() => ({
  invalidateDashboardCache: vi.fn(),
  refreshCategoriasCache: vi.fn(),
}));

vi.mock('@/lib/supabase/domain-read-adapters', () => domainReadAdapters);
vi.mock('@/lib/supabase/ventas-repository', () => ventasRepository);
vi.mock('@/lib/use-cases/servicios/servicios-payment-use-cases', () => servicioPayments);
vi.mock('@/lib/use-cases/ventas/ventas-write-use-cases', () => ventasWrite);
vi.mock('@/lib/use-cases/terceros-use-cases', () => tercerosUseCases);
vi.mock('@/lib/commands/client-cache', () => clientCache);
vi.mock('@/lib/activity/activity-log-writer', () => ({
  getActivityLogOptions: vi.fn(() => ({ logContext: { usuarioId: 'u1', usuarioEmail: 'u@test.com' } })),
}));

import {
  cutVentaFromServicioDetalleWorkflow,
  deleteServicioDetalleWorkflow,
  deleteServicioPagoDetalleWorkflow,
  fetchServicioDetalleBundleUseCase,
  fetchServicioVentasProfilesUseCase,
  renewServicioDetalleWorkflow,
  transferVentaFromServicioDetalleWorkflow,
  updateServicioPagoDetalleWorkflow,
} from './servicio-detail-use-cases';
import type { ActivityLogOptions } from '@/lib/activity/activity-log-writer';
import type { MetodoPago, PagoServicio, Servicio, VentaDoc } from '@/types';

const testLog = {
  logContext: { usuarioId: 'u1', usuarioEmail: 'u@test.com' },
  recordActivityLog: vi.fn(),
} as unknown as ActivityLogOptions;

const servicio = {
  id: 'servicio-1',
  nombre: 'Netflix',
  correo: 'netflix@test.com',
  categoriaId: 'categoria-1',
  categoriaNombre: 'Streaming',
  moneda: 'USD',
  renovacionAutomatica: false,
} as Servicio;

const venta = {
  id: 'venta-1',
  clienteId: 'cliente-1',
  clienteNombre: 'Cliente Uno',
  servicioId: 'servicio-1',
  estado: 'activo',
} as VentaDoc;

describe('servicio detail workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a servicio bundle without leaking repository details to UI helpers', async () => {
    domainReadAdapters.getServicioRead.mockResolvedValue({
      ...servicio,
      metodoPagoId: 'metodo-1',
      metodoPagoNombre: 'Yappy',
    });
    domainReadAdapters.getMetodoPagoRead.mockResolvedValue({
      id: 'metodo-1',
      nombre: 'Tarjeta',
      moneda: 'COP',
      alias: 'Principal',
    });

    const bundle = await fetchServicioDetalleBundleUseCase('servicio-1');

    expect(bundle).toMatchObject({
      categoria: { id: 'categoria-1', nombre: 'Streaming' },
      metodoPago: { id: 'metodo-1', nombre: 'Tarjeta', moneda: 'COP' },
      servicio: { id: 'servicio-1' },
    });
  });

  it('loads only active venta profiles for servicio detail', async () => {
    ventasRepository.queryVentas.mockResolvedValue([
      { ...venta, id: 'venta-1', estado: 'activo', perfilNumero: 1 },
      { ...venta, id: 'venta-2', estado: 'inactivo', perfilNumero: 2 },
    ]);

    const profiles = await fetchServicioVentasProfilesUseCase('servicio-1');

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ ventaId: 'venta-1', perfilNumero: 1 });
  });

  it('deletes a servicio and runs cache seams through injected dependencies', async () => {
    const deps = {
      deleteServicio: vi.fn().mockResolvedValue(undefined),
      invalidateCategorias: vi.fn().mockResolvedValue(undefined),
      refreshCounts: vi.fn().mockResolvedValue(undefined),
    };

    const outcome = await deleteServicioDetalleWorkflow({
      deletePayments: true,
      deps,
      id: 'servicio-1',
    });

    expect(outcome).toEqual({ type: 'servicioDeleted', deletedPayments: true });
    expect(deps.deleteServicio).toHaveBeenCalledWith('servicio-1', true);
    expect(deps.refreshCounts).toHaveBeenCalledTimes(1);
    expect(deps.invalidateCategorias).toHaveBeenCalledTimes(1);
  });

  it('updates a servicio payment with latest-payment context', async () => {
    const pago = { id: 'pago-1' } as PagoServicio;
    const servicioActualizado = { ...servicio, costoServicio: 22 };
    servicioPayments.updateServicioPagoUseCase.mockResolvedValue({ servicioActualizado });

    const outcome = await updateServicioPagoDetalleWorkflow({
      data: {
        costo: 22,
        metodoPagoId: 'metodo-1',
        periodoRenovacion: 'mensual',
        fechaInicio: new Date('2026-06-01T00:00:00.000Z'),
        fechaVencimiento: new Date('2026-07-01T00:00:00.000Z'),
      },
      metodosPago: [{ id: 'metodo-1', nombre: 'Tarjeta' }] as MetodoPago[],
      pago,
      pagosOrdenados: [pago],
      servicio,
    });

    expect(outcome).toEqual({ type: 'servicioPaymentUpdated', servicioActualizado });
    expect(servicioPayments.updateServicioPagoUseCase).toHaveBeenCalledWith(
      servicio,
      pago,
      expect.objectContaining({ costo: 22 }),
      expect.objectContaining({ isLatestPayment: true }),
    );
  });

  it('deletes a servicio payment and reports whether it was the latest payment', async () => {
    const pago = { id: 'pago-1' } as PagoServicio;
    const olderPago = { id: 'pago-0' } as PagoServicio;
    const deps = {
      invalidateCategorias: vi.fn().mockResolvedValue(undefined),
      refreshPagos: vi.fn().mockResolvedValue(undefined),
    };
    servicioPayments.deleteServicioPagoUseCase.mockResolvedValue({
      servicioActualizado: { ...servicio, costoServicio: 10 },
    });

    const outcome = await deleteServicioPagoDetalleWorkflow({
      deps,
      fallbackMoneda: 'USD',
      id: 'servicio-1',
      pago,
      pagosOrdenados: [pago, olderPago],
      pagosServicio: [pago, olderPago],
      servicio,
    });

    expect(outcome).toMatchObject({ type: 'servicioPaymentDeleted', latestPayment: true });
    expect(servicioPayments.deleteServicioPagoUseCase).toHaveBeenCalledWith(
      servicio,
      pago,
      [olderPago],
      expect.objectContaining({ fallbackMoneda: 'USD', isLatestPayment: true }),
    );
    expect(deps.invalidateCategorias).toHaveBeenCalledTimes(1);
    expect(deps.refreshPagos).toHaveBeenCalledTimes(1);
  });

  it('renews a servicio and returns an explicit outcome', async () => {
    const deps = {
      deleteNotificacionesPorServicio: vi.fn().mockResolvedValue(undefined),
      invalidateNotifications: vi.fn().mockResolvedValue(undefined),
      refreshPagos: vi.fn(),
    };
    const servicioActualizado = { ...servicio, costoServicio: 20 };
    servicioPayments.renewServicioUseCase.mockResolvedValue({
      servicioActualizado,
      pronostico: { id: 'servicio-1' },
    });

    const outcome = await renewServicioDetalleWorkflow({
      data: {
        costo: 20,
        metodoPagoId: 'metodo-1',
        periodoRenovacion: 'mensual',
        fechaInicio: new Date('2026-06-01T00:00:00.000Z'),
        fechaVencimiento: new Date('2026-07-01T00:00:00.000Z'),
      },
      deps,
      id: 'servicio-1',
      metodosPago: [{ id: 'metodo-1', nombre: 'Tarjeta' }] as MetodoPago[],
      renovaciones: 2,
      servicio,
    });

    expect(outcome).toEqual({ type: 'servicioRenewed', servicioActualizado });
    expect(servicioPayments.renewServicioUseCase).toHaveBeenCalledWith(
      servicio,
      expect.objectContaining({ metodoPagoId: 'metodo-1' }),
      expect.objectContaining({ numeroRenovacion: 3 }),
    );
    expect(deps.deleteNotificacionesPorServicio).toHaveBeenCalledWith('servicio-1');
    expect(deps.invalidateNotifications).toHaveBeenCalledTimes(1);
  });

  it('cuts a venta from servicio detail through injected seams', async () => {
    const deps = {
      deleteNotificacionesPorVenta: vi.fn().mockResolvedValue(undefined),
      invalidateNotifications: vi.fn().mockResolvedValue(undefined),
      updatePerfilOcupado: vi.fn().mockResolvedValue(undefined),
    };
    ventasWrite.updateVentaUseCase.mockResolvedValue({
      serviceProfileDelta: { servicioId: 'servicio-1', shouldIncrement: false },
    });

    const outcome = await cutVentaFromServicioDetalleWorkflow({
      deps,
      log: testLog,
      motivoCorte: 'Mora',
      venta,
    });

    expect(outcome).toEqual({
      type: 'servicioVentaCut',
      ventaId: 'venta-1',
      serviceProfileUpdated: true,
    });
    expect(deps.updatePerfilOcupado).toHaveBeenCalledWith('servicio-1', false);
    expect(deps.deleteNotificacionesPorVenta).toHaveBeenCalledWith('venta-1');
  });

  it('transfers a venta and loads tercero only when WhatsApp is requested', async () => {
    const deps = {
      invalidateNotifications: vi.fn().mockResolvedValue(undefined),
      updatePerfilOcupado: vi.fn().mockResolvedValue(undefined),
    };
    tercerosUseCases.getTerceroUseCase.mockResolvedValue({ id: 'cliente-1', telefono: '+50760000000' });

    const outcome = await transferVentaFromServicioDetalleWorkflow({
      codigo: '1234',
      deps,
      log: testLog,
      notificarWhatsApp: true,
      perfilNombre: 'Perfil 1',
      perfilNumero: 1,
      targetServicio: { ...servicio, id: 'servicio-2' },
      venta,
    });

    expect(outcome).toMatchObject({
      type: 'servicioVentaTransferred',
      ventaId: 'venta-1',
      targetServicioId: 'servicio-2',
      whatsappRequested: true,
      tercero: { id: 'cliente-1' },
    });
    expect(deps.updatePerfilOcupado).toHaveBeenCalledWith('servicio-1', false);
    expect(deps.updatePerfilOcupado).toHaveBeenCalledWith('servicio-2', true);
  });
});
