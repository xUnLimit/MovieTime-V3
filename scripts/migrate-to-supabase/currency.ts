import type { MigrationContext, FirestoreDoc } from './types';
import { asOptionalString, asNumber, upsertRows } from './helpers';

type Conversion = {
  original: number;
  currency: string;
  usd: number;
  rate: number | null;
};

export class CurrencyConverter {
  private rates = new Map<string, number>([
    ['USD_USD', 1],
    ['PAB_USD', 1],
    ['USD_PAB', 1],
  ]);
  private missingRateWarnings = new Set<string>();

  async load(ctx: MigrationContext) {
    if (ctx.options.dryRun) return;
    const { data, error } = await ctx.supabase
      .from('exchange_rates')
      .select('currency_pair, rate');
    if (error) throw new Error(`Could not load exchange rates: ${error.message}`);
    for (const row of data ?? []) {
      this.rates.set(row.currency_pair, Number(row.rate));
    }
  }

  mergeRates(rates: Map<string, number>) {
    for (const [pair, rate] of rates) {
      this.rates.set(pair, rate);
    }
  }

  convert(ctx: MigrationContext, amountValue: unknown, currencyValue: unknown): Conversion {
    const original = asNumber(amountValue, 0);
    const currency = normalizeCurrency(currencyValue);
    if (currency === 'USD' || currency === 'PAB') {
      return { original, currency, usd: original, rate: 1 };
    }

    const direct = this.rates.get(`${currency}_USD`);
    if (direct && direct > 0) {
      return { original, currency, usd: roundMoney(original * direct), rate: direct };
    }

    const inverse = this.rates.get(`USD_${currency}`);
    if (inverse && inverse > 0) {
      return { original, currency, usd: roundMoney(original / inverse), rate: inverse };
    }

    const message = `Missing exchange rate for ${currency}`;
    if (ctx.options.dryRun) {
      if (!this.missingRateWarnings.has(currency)) {
        this.missingRateWarnings.add(currency);
        ctx.report.warn(message, { currency, assumedRateForDryRun: 1 });
      }
      return { original, currency, usd: original, rate: null };
    }
    throw new Error(message);
  }
}

export function normalizeCurrency(value: unknown): string {
  return (asOptionalString(value) ?? 'USD').trim().toUpperCase();
}

export async function migrateCurrencies(ctx: MigrationContext, docsByCollection: Record<string, FirestoreDoc[]>) {
  const codes = new Set(['USD', 'PAB', 'ARS', 'TRY']);

  for (const docs of Object.values(docsByCollection)) {
    for (const doc of docs) {
      for (const key of ['moneda', 'monedaOriginal', 'moneda_original']) {
        const value = doc[key];
        if (value) codes.add(normalizeCurrency(value));
      }
    }
  }

  const configDocs = docsByCollection.config ?? [];
  const ratePairs = getCurrencyPairsFromConfigDocs(configDocs);
  ctx.currency.mergeRates(ratePairs);

  await upsertRows(
    ctx,
    'currencies',
    [...codes].sort().map((code) => ({
      code,
      nombre: code,
      activo: true,
    })),
    'code'
  );

  const rateRows = [...ratePairs]
    .filter(([currencyPair]) => {
      if (currencyPair === 'USD_USD') return true;
      const match = currencyPair.match(/^USD_([A-Z]{3})$/);
      return Boolean(match && codes.has(match[1]));
    })
    .map(([currencyPair, rate]) => ({
      currency_pair: currencyPair,
      rate,
      source: 'firebase-config',
    }));
  await upsertRows(ctx, 'exchange_rates', rateRows, 'currency_pair');
}

export function getCurrencyPairsFromConfig(config: FirestoreDoc | undefined): Map<string, number> {
  const rates = new Map<string, number>([['USD_USD', 1]]);
  collectRatePairs(rates, config?.tasasCambio);
  collectRatePairs(rates, config?.rates);
  return rates;
}

function getCurrencyPairsFromConfigDocs(configDocs: FirestoreDoc[]): Map<string, number> {
  const rates = new Map<string, number>([['USD_USD', 1]]);
  for (const config of configDocs) {
    collectRatePairs(rates, config.tasasCambio);
    collectRatePairs(rates, config.rates);
  }
  return rates;
}

function collectRatePairs(rates: Map<string, number>, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (/^[A-Z]{3}_[A-Z]{3}$/.test(key)) {
      rates.set(key, asNumber(nested, 1));
    }
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}
