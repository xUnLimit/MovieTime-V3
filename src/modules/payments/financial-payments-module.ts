import {
  createInitialServicioPayment,
  createInitialVentaPayment,
  createRenewalServicioPayment,
  createRenewalVentaPayment,
} from './payment-factory';
import { formatAggregateInUSD, sumPaymentsInUSD } from './payment-calculator';
import { convertToUSD, convertToUSDSync } from './currency-converter';

type CicloPago = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export type MoneyInput = {
  amount: number;
  currency?: string | null;
};

export type MonetarySnapshot = {
  amountOriginal: number;
  currencyOriginal: string;
  amountUsd: number;
};

export type SignedPaymentMovement = MonetarySnapshot & {
  direction: 'income' | 'refund';
  signedUsd: number;
};

export type RegisterVentaPaymentCommand = {
  idempotencyKey?: string;
  ventaId: string;
  clienteId: string;
  clienteNombre: string;
  categoriaId: string;
  total: number;
  metodoPagoNombre: string;
  metodoPagoId?: string | null;
  moneda?: string | null;
  cicloPago?: CicloPago | null;
  notas?: string | null;
  fechaInicio?: Date | null;
  fechaVencimiento?: Date | null;
  precio?: number | null;
  descuento?: number | null;
  planId?: string | null;
  planNombre?: string | null;
  planTipoNombre?: string | null;
};

export type RegisterServicioPaymentCommand = {
  idempotencyKey?: string;
  servicioId: string;
  categoriaId: string;
  monto: number;
  metodoPagoId?: string | null;
  metodoPagoNombre: string;
  moneda?: string | null;
  cicloPago: CicloPago;
  fechaInicio: Date;
  fechaVencimiento: Date;
  notas?: string | null;
  renovacionAutomatica?: boolean | null;
  numeroRenovacion?: number | null;
};

export async function createMonetarySnapshot(input: MoneyInput): Promise<MonetarySnapshot> {
  const currency = input.currency || 'USD';
  return {
    amountOriginal: input.amount,
    currencyOriginal: currency,
    amountUsd: await convertToUSD(input.amount, currency),
  };
}

export function normalizeRefundMovement(snapshot: MonetarySnapshot): SignedPaymentMovement {
  return {
    ...snapshot,
    direction: 'refund',
    signedUsd: -Math.abs(snapshot.amountUsd),
  };
}

export function normalizeIncomeMovement(snapshot: MonetarySnapshot): SignedPaymentMovement {
  return {
    ...snapshot,
    direction: 'income',
    signedUsd: Math.abs(snapshot.amountUsd),
  };
}

export async function calculateTotalUsd(items: MoneyInput[]) {
  return sumPaymentsInUSD(items.map((item) => ({ monto: item.amount, moneda: item.currency })));
}

export function calculateTotalUsdSync(items: MoneyInput[]) {
  return items.reduce((total, item) => total + convertToUSDSync(item.amount, item.currency || 'USD'), 0);
}

export async function registerInitialVentaPayment(command: RegisterVentaPaymentCommand): Promise<string> {
  return createInitialVentaPayment(
    command.ventaId,
    command.clienteId,
    command.clienteNombre,
    command.categoriaId,
    command.total,
    command.metodoPagoNombre,
    command.metodoPagoId ?? undefined,
    command.moneda ?? undefined,
    command.cicloPago ?? undefined,
    command.notas ?? undefined,
    command.fechaInicio ?? undefined,
    command.fechaVencimiento ?? undefined,
    command.idempotencyKey
  );
}

export async function registerRenewalVentaPayment(command: RegisterVentaPaymentCommand): Promise<string> {
  return createRenewalVentaPayment(
    command.ventaId,
    command.clienteId,
    command.clienteNombre,
    command.categoriaId,
    command.total,
    command.metodoPagoNombre,
    command.metodoPagoId ?? undefined,
    command.moneda ?? undefined,
    command.cicloPago ?? undefined,
    command.notas ?? undefined,
    command.fechaInicio ?? undefined,
    command.fechaVencimiento ?? undefined,
    command.precio ?? undefined,
    command.descuento ?? undefined,
    command.planId ?? undefined,
    command.planNombre ?? undefined,
    command.planTipoNombre ?? undefined,
    command.idempotencyKey
  );
}

export async function registerInitialServicioPayment(command: RegisterServicioPaymentCommand): Promise<void> {
  await createInitialServicioPayment(
    command.servicioId,
    command.categoriaId,
    command.monto,
    command.metodoPagoId ?? '',
    command.metodoPagoNombre,
    command.moneda ?? 'USD',
    command.cicloPago,
    command.fechaInicio,
    command.fechaVencimiento,
    command.notas ?? undefined,
    command.renovacionAutomatica ?? undefined,
    command.idempotencyKey
  );
}

export async function registerRenewalServicioPayment(command: RegisterServicioPaymentCommand): Promise<void> {
  await createRenewalServicioPayment(
    command.servicioId,
    command.categoriaId,
    command.monto,
    command.metodoPagoId ?? '',
    command.metodoPagoNombre,
    command.moneda ?? 'USD',
    command.cicloPago,
    command.fechaInicio,
    command.fechaVencimiento,
    command.numeroRenovacion ?? 1,
    command.notas ?? undefined,
    command.renovacionAutomatica ?? undefined,
    command.idempotencyKey
  );
}

export const financialPayments = {
  registerInitialVentaPayment,
  registerRenewalVentaPayment,
  registerInitialServicioPayment,
  registerRenewalServicioPayment,
  createMonetarySnapshot,
  normalizeRefundMovement,
  normalizeIncomeMovement,
  calculateTotalUsd,
  calculateTotalUsdSync,
  formatTotalUsd: formatAggregateInUSD,
};

export type RegisterVentaPaymentInput = RegisterVentaPaymentCommand;
export type RegisterServicioPaymentInput = RegisterServicioPaymentCommand;
export type PaymentCycle = CicloPago;
