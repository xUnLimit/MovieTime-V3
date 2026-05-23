import { convertToUSD } from './currency-converter';

export type PaymentAmount = {
  monto: number;
  moneda?: string | null;
};

export async function sumPaymentsInUSD(
  payments: PaymentAmount[],
  converter: (amount: number, currency: string) => Promise<number> = convertToUSD
): Promise<number> {
  const amounts = await Promise.all(
    payments.map((payment) => converter(payment.monto, payment.moneda ?? 'USD'))
  );

  return amounts.reduce((total, amount) => total + amount, 0);
}

export async function sumInUSD(items: Array<{ monto: number; moneda?: string | null }>): Promise<number> {
  return sumPaymentsInUSD(items);
}

export function formatAggregateInUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;
}
