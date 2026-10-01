import { beforeEach, describe, expect, it, vi } from 'vitest';

const pagosRepository = vi.hoisted(() => ({
  queryPagosServicio: vi.fn(),
  queryPagosVenta: vi.fn(),
}));
const currency = vi.hoisted(() => ({ convertToUSD: vi.fn() }));
const paymentsRepository = vi.hoisted(() => ({
  createPagoServicio: vi.fn(),
  createPagoVenta: vi.fn(),
}));

vi.mock('@/platform/supabase/pagos-repository', () => pagosRepository);
vi.mock('@/platform/supabase/payments-repository', () => paymentsRepository);
vi.mock('./currency-converter', () => ({ convertToUSD: currency.convertToUSD }));

import { createInitialServicioPayment, createInitialVentaPayment, createRenewalServicioPayment, createRenewalVentaPayment, getServicioPayments } from './payment-factory';

describe('payment-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currency.convertToUSD.mockImplementation(async (amount: number) => amount);
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

  it('converts non-USD amounts before calling the repositories', async () => {
    currency.convertToUSD.mockResolvedValue(10);

    await createInitialVentaPayment('venta-1', 'c-1', 'Cliente', 'cat-1', 20, 'Banco', 'm-1', 'EUR');
    await createInitialServicioPayment(
      'servicio-1', 'cat-1', 20, 'm-1', 'Banco', 'EUR', 'mensual',
      new Date('2026-05-01T00:00:00Z'), new Date('2026-06-01T00:00:00Z'),
    );

    expect(currency.convertToUSD).toHaveBeenCalledWith(20, 'EUR');
    expect(paymentsRepository.createPagoVenta).toHaveBeenCalledWith(expect.objectContaining({ montoUsd: 10, exchangeRate: 2 }));
    expect(paymentsRepository.createPagoServicio).toHaveBeenCalledWith(expect.objectContaining({ montoUsd: 10, exchangeRate: 2 }));
  });

  it.each([
    ['USD currency', 20, 'USD', 20],
    ['zero amount', 0, 'EUR', 0],
    ['zero conversion', 20, 'EUR', 0],
  ])('uses a neutral exchange rate for %s', async (_label, monto, moneda, usd) => {
    currency.convertToUSD.mockResolvedValue(usd);

    await createInitialVentaPayment('venta-1', 'c-1', 'Cliente', 'cat-1', monto, 'Banco', 'm-1', moneda);

    expect(paymentsRepository.createPagoVenta).toHaveBeenCalledWith(expect.objectContaining({ montoUsd: usd, exchangeRate: 1 }));
  });

  it('defaults to USD and does not persist when conversion fails', async () => {
    await createRenewalServicioPayment(
      'servicio-1', 'cat-1', 5, 'm-1', 'Banco', undefined as unknown as string, 'mensual',
      new Date('2026-05-01T00:00:00Z'), new Date('2026-06-01T00:00:00Z'), 1,
    );
    expect(currency.convertToUSD).toHaveBeenCalledWith(5, 'USD');

    currency.convertToUSD.mockRejectedValueOnce(new Error('rate unavailable'));
    await expect(createInitialVentaPayment('venta-1', 'c-1', 'Cliente', 'cat-1', 20, 'Banco', 'm-1', 'EUR'))
      .rejects.toThrow('rate unavailable');
    expect(paymentsRepository.createPagoVenta).not.toHaveBeenCalled();
  });
});
