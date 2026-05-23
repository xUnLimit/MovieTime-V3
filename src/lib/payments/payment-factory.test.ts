import { beforeEach, describe, expect, it, vi } from 'vitest';

const pagosRepository = vi.hoisted(() => ({
  createPagoServicio: vi.fn(),
  createPagoVenta: vi.fn(),
  queryPagosServicio: vi.fn(),
  queryPagosVenta: vi.fn(),
}));

vi.mock('@/lib/supabase/pagos-repository', () => pagosRepository);

import {
  countServicioRenewals,
  countVentaRenewals,
  createInitialServicioPayment,
  createInitialVentaPayment,
  createRenewalServicioPayment,
  createRenewalVentaPayment,
  getManyServicioPayments,
  getManyVentaPayments,
  getServicioPayments,
  getVentaPayments,
} from './payment-factory';

describe('payment-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pagosRepository.createPagoVenta.mockResolvedValue('pago-venta-1');
    pagosRepository.createPagoServicio.mockResolvedValue('pago-servicio-1');
    pagosRepository.queryPagosVenta.mockResolvedValue([]);
    pagosRepository.queryPagosServicio.mockResolvedValue([]);
  });

  it('creates initial and renewal venta payments with denormalized snapshots', async () => {
    await expect(createInitialVentaPayment(
      'venta-1',
      'cliente-1',
      'Cliente Uno',
      'categoria-1',
      10,
      'Banco',
      'metodo-1',
      'USD',
      'mensual',
      'Inicial'
    )).resolves.toBe('pago-venta-1');

    await createRenewalVentaPayment(
      'venta-1',
      'cliente-1',
      'Cliente Uno',
      'categoria-1',
      12,
      'Banco',
      'metodo-1',
      'USD',
      'mensual',
      'Renovacion',
      new Date('2026-05-01T00:00:00Z'),
      new Date('2026-06-01T00:00:00Z'),
      15,
      20,
      'plan-1',
      'Mensual',
      'Perfil'
    );

    expect(pagosRepository.createPagoVenta).toHaveBeenNthCalledWith(1, expect.objectContaining({
      ventaId: 'venta-1',
      isPagoInicial: true,
      monto: 10,
      notas: 'Inicial',
    }));
    expect(pagosRepository.createPagoVenta).toHaveBeenNthCalledWith(2, expect.objectContaining({
      ventaId: 'venta-1',
      isPagoInicial: false,
      precio: 15,
      descuento: 20,
      planId: 'plan-1',
    }));
  });

  it('creates initial and renewal servicio payments', async () => {
    await createInitialServicioPayment(
      'servicio-1',
      'categoria-1',
      9,
      'metodo-1',
      'Banco',
      'USD',
      'mensual',
      new Date('2026-05-01T00:00:00Z'),
      new Date('2026-06-01T00:00:00Z')
    );

    await createRenewalServicioPayment(
      'servicio-1',
      'categoria-1',
      11,
      'metodo-1',
      'Banco',
      'USD',
      'mensual',
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-07-01T00:00:00Z'),
      2,
      'Renovacion'
    );

    expect(pagosRepository.createPagoServicio).toHaveBeenNthCalledWith(1, expect.objectContaining({
      servicioId: 'servicio-1',
      descripcion: 'Pago inicial',
      isPagoInicial: true,
    }));
    expect(pagosRepository.createPagoServicio).toHaveBeenNthCalledWith(2, expect.objectContaining({
      servicioId: 'servicio-1',
      descripcion: 'Renovación #2',
      isPagoInicial: false,
      notas: 'Renovacion',
    }));
  });

  it('queries and counts venta renewal payments', async () => {
    pagosRepository.queryPagosVenta.mockResolvedValue([
      { id: 'pago-1', isPagoInicial: true },
      { id: 'pago-2', isPagoInicial: false },
    ]);

    await expect(getVentaPayments('venta-1')).resolves.toHaveLength(2);
    await expect(countVentaRenewals('venta-1')).resolves.toBe(1);
    expect(pagosRepository.queryPagosVenta).toHaveBeenCalledWith([
      { field: 'ventaId', operator: '==', value: 'venta-1' },
    ]);
  });

  it('queries and sorts servicio payments by newest date', async () => {
    pagosRepository.queryPagosServicio.mockResolvedValue([
      { id: 'old', fecha: new Date('2026-05-01T00:00:00Z'), isPagoInicial: true },
      { id: 'new', fecha: new Date('2026-06-01T00:00:00Z'), isPagoInicial: false, descripcion: 'Renovacion #1' },
    ]);

    await expect(getServicioPayments('servicio-1')).resolves.toMatchObject([
      { id: 'new' },
      { id: 'old' },
    ]);
    await expect(countServicioRenewals('servicio-1')).resolves.toBe(1);
  });

  it('chunks batch payment queries', async () => {
    pagosRepository.queryPagosVenta.mockResolvedValue([{ id: 'venta-payment' }]);
    pagosRepository.queryPagosServicio.mockResolvedValue([{ id: 'servicio-payment', fecha: new Date('2026-01-01') }]);

    await expect(getManyVentaPayments(Array.from({ length: 11 }, (_, index) => `venta-${index}`)))
      .resolves.toHaveLength(2);
    await expect(getManyServicioPayments(Array.from({ length: 11 }, (_, index) => `servicio-${index}`)))
      .resolves.toHaveLength(2);

    expect(pagosRepository.queryPagosVenta).toHaveBeenCalledTimes(2);
    expect(pagosRepository.queryPagosServicio).toHaveBeenCalledTimes(2);
  });
});
