type PaymentAmount = {
  monto: number;
  moneda?: string | null;
};

export async function sumPaymentsInUSD(
  payments: PaymentAmount[],
  convertToUSD: (amount: number, currency: string) => Promise<number>
): Promise<number> {
  const amounts = await Promise.all(
    payments.map((payment) => convertToUSD(payment.monto, payment.moneda ?? 'USD'))
  );

  return amounts.reduce((total, amount) => total + amount, 0);
}
