import { beforeEach, describe, expect, it, vi } from 'vitest';

const paymentFactory = vi.hoisted(() => ({
  createInitialVentaPayment: vi.fn(),
  createRenewalVentaPayment: vi.fn(),
  createInitialServicioPayment: vi.fn(),
  createRenewalServicioPayment: vi.fn(),
}));

vi.mock('./payment-factory', () => paymentFactory);

vi.mock('@/lib/services/currencyService', () => ({
  currencyService: {
    convertToUSD: vi.fn(async (amount: number, currency: string) => currency === 'USD' ? amount : amount * 2),
    convertToUSDSync: vi.fn((amount: number, currency: string) => currency === 'USD' ? amount : amount * 2),
  },
}));

import {
  calculateTotalUsd,
  calculateTotalUsdSync,
  createMonetarySnapshot,
  financialPayments,
  normalizeIncomeMovement,
  normalizeRefundMovement,
  registerInitialServicioPayment,
  registerInitialVentaPayment,
  registerRenewalServicioPayment,
  registerRenewalVentaPayment,
} from './financial-payments-module';

describe('financial-payments-module', () => {
  const fechaInicio = new Date('2026-05-01T00:00:00.000Z');
  const fechaVencimiento = new Date('2026-06-01T00:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    paymentFactory.createInitialVentaPayment.mockResolvedValue('pago-venta-inicial');
    paymentFactory.createRenewalVentaPayment.mockResolvedValue('pago-venta-renovacion');
    paymentFactory.createInitialServicioPayment.mockResolvedValue(undefined);
    paymentFactory.createRenewalServicioPayment.mockResolvedValue(undefined);
  });

  it('registers initial venta payments through the command boundary', async () => {
    await expect(registerInitialVentaPayment({
      ventaId: 'venta-1',
      clienteId: 'cliente-1',
      clienteNombre: 'Cliente Uno',
      categoriaId: 'cat-1',
      total: 50,
      metodoPagoNombre: 'Tarjeta',
      metodoPagoId: 'metodo-1',
      moneda: 'USD',
      cicloPago: 'mensual',
      notas: 'Alta',
      fechaInicio,
      fechaVencimiento,
    })).resolves.toBe('pago-venta-inicial');

    expect(paymentFactory.createInitialVentaPayment).toHaveBeenCalledWith(
      'venta-1',
      'cliente-1',
      'Cliente Uno',
      'cat-1',
      50,
      'Tarjeta',
      'metodo-1',
      'USD',
      'mensual',
      'Alta',
      fechaInicio,
      fechaVencimiento
    );
  });

  it('registers renewal venta payments through the command boundary', async () => {
    await expect(registerRenewalVentaPayment({
      ventaId: 'venta-2',
      clienteId: 'cliente-2',
      clienteNombre: 'Cliente Dos',
      categoriaId: 'cat-2',
      total: 70,
      metodoPagoNombre: 'Efectivo',
      metodoPagoId: null,
      moneda: null,
      cicloPago: null,
      notas: null,
      fechaInicio: null,
      fechaVencimiento: null,
      precio: 80,
      descuento: 10,
      planId: 'plan-1',
      planNombre: 'Premium',
      planTipoNombre: 'Streaming',
    })).resolves.toBe('pago-venta-renovacion');

    expect(paymentFactory.createRenewalVentaPayment).toHaveBeenCalledWith(
      'venta-2',
      'cliente-2',
      'Cliente Dos',
      'cat-2',
      70,
      'Efectivo',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      80,
      10,
      'plan-1',
      'Premium',
      'Streaming'
    );
  });

  it('registers initial servicio payments through the command boundary', async () => {
    await registerInitialServicioPayment({
      servicioId: 'servicio-1',
      categoriaId: 'cat-1',
      monto: 20,
      metodoPagoId: null,
      metodoPagoNombre: 'Transferencia',
      moneda: null,
      cicloPago: 'mensual',
      fechaInicio,
      fechaVencimiento,
      notas: null,
      renovacionAutomatica: null,
    });

    expect(paymentFactory.createInitialServicioPayment).toHaveBeenCalledWith(
      'servicio-1',
      'cat-1',
      20,
      '',
      'Transferencia',
      'USD',
      'mensual',
      fechaInicio,
      fechaVencimiento,
      undefined,
      undefined
    );
  });

  it('registers renewal servicio payments through the command boundary', async () => {
    await registerRenewalServicioPayment({
      servicioId: 'servicio-2',
      categoriaId: 'cat-2',
      monto: 35,
      metodoPagoId: 'metodo-2',
      metodoPagoNombre: 'Tarjeta',
      moneda: 'COP',
      cicloPago: 'anual',
      fechaInicio,
      fechaVencimiento,
      numeroRenovacion: null,
      notas: 'Renovacion',
      renovacionAutomatica: true,
    });

    expect(paymentFactory.createRenewalServicioPayment).toHaveBeenCalledWith(
      'servicio-2',
      'cat-2',
      35,
      'metodo-2',
      'Tarjeta',
      'COP',
      'anual',
      fechaInicio,
      fechaVencimiento,
      1,
      'Renovacion',
      true
    );
  });

  it('exposes the command API through financialPayments', () => {
    expect(financialPayments).toMatchObject({
      registerInitialVentaPayment,
      registerRenewalVentaPayment,
      registerInitialServicioPayment,
      registerRenewalServicioPayment,
    });
  });

  it('creates monetary snapshots behind the payments module boundary', async () => {
    await expect(createMonetarySnapshot({ amount: 10, currency: 'EUR' })).resolves.toEqual({
      amountOriginal: 10,
      currencyOriginal: 'EUR',
      amountUsd: 20,
    });
  });

  it('normalizes signed income and refund movements', () => {
    const snapshot = { amountOriginal: 15, currencyOriginal: 'USD', amountUsd: 15 };

    expect(normalizeIncomeMovement(snapshot)).toMatchObject({ direction: 'income', signedUsd: 15 });
    expect(normalizeRefundMovement(snapshot)).toMatchObject({ direction: 'refund', signedUsd: -15 });
  });

  it('calculates totals with async and sync currency conversion', async () => {
    const items = [
      { amount: 10, currency: 'USD' },
      { amount: 10, currency: 'EUR' },
    ];

    await expect(calculateTotalUsd(items)).resolves.toBe(30);
    expect(calculateTotalUsdSync(items)).toBe(30);
  });
});
