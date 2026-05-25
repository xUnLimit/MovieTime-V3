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

export const financialPayments = {
  registerInitialVentaPayment: createInitialVentaPayment,
  registerRenewalVentaPayment: createRenewalVentaPayment,
  registerInitialServicioPayment: createInitialServicioPayment,
  registerRenewalServicioPayment: createRenewalServicioPayment,
  createMonetarySnapshot,
  normalizeRefundMovement,
  normalizeIncomeMovement,
  calculateTotalUsd,
  calculateTotalUsdSync,
  formatTotalUsd: formatAggregateInUSD,
};

export type RegisterVentaPaymentInput = Parameters<typeof createRenewalVentaPayment>;
export type RegisterServicioPaymentInput = Parameters<typeof createRenewalServicioPayment>;
export type PaymentCycle = CicloPago;
