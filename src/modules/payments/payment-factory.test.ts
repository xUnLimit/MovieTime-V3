import { beforeEach, describe, expect, it, vi } from 'vitest';

const pagosRepository = vi.hoisted(() => ({
  queryPagosServicio: vi.fn(),
  queryPagosVenta: vi.fn(),
}));
const paymentsRepository = vi.hoisted(() => ({
  createPagoServicio: vi.fn(),
  createPagoVenta: vi.fn(),
}));

vi.mock('@/platform/supabase/pagos-repository', () => pagosRepository);
vi.mock('@/platform/supabase/payments-repository', () => paymentsRepository);

import { createInitialServicioPayment, createInitialVentaPayment, createRenewalServicioPayment, createRenewalVentaPayment, getServicioPayments } from './payment-factory';

describe('payment-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentsRepository.createPagoVenta.mockResolvedValue('pago-venta-1');
    paymentsRepository.createPagoServicio.mockResolvedValue('pago-servicio-1');
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

    expect(paymentsRepository.createPagoVenta).toHaveBeenNthCalledWith(1, expect.objectContaining({
      ventaId: 'venta-1',
      isPagoInicial: true,
      monto: 10,
      notas: 'Inicial',
    }));
    expect(paymentsRepository.createPagoVenta).toHaveBeenNthCalledWith(2, expect.objectContaining({
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

    expect(paymentsRepository.createPagoServicio).toHaveBeenNthCalledWith(1, expect.objectContaining({
      servicioId: 'servicio-1',
      descripcion: 'Pago inicial',
      isPagoInicial: true,
    }));
    expect(paymentsRepository.createPagoServicio).toHaveBeenNthCalledWith(2, expect.objectContaining({
      servicioId: 'servicio-1',
      descripcion: 'Renovación #2',
      isPagoInicial: false,
      notas: 'Renovacion',
    }));
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
  });
});
