export const CYCLE_MONTHS = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
} as const;

export type CicloPago = keyof typeof CYCLE_MONTHS;

export const CACHE_TTL_MS = 5 * 60 * 1000;

export const REPOSO_DAY_OPTIONS = [7, 28, 29, 30, 31] as const;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  PAB: "B/.",
  EUR: "\u20ac",
  GBP: "\u00a3",
  JPY: "\u00a5",
  CNY: "\u00a5",
  INR: "\u20b9",
  NGN: "\u20a6",
  BRL: "R$",
  MXN: "$",
  CAD: "C$",
  AUD: "A$",
  CHF: "Fr",
  ARS: "$",
  CLP: "$",
  COP: "$",
  PEN: "S/",
  CRC: "\u20a1",
  VES: "Bs.",
  TRY: "\u20ba",
  EGP: "E\u00a3",
  BTC: "\u20bf",
  ETH: "\u039e",
  USDT: "$",
  USDC: "$",
};

export const getCurrencySymbol = (moneda?: string): string => {
  if (!moneda) return "$";
  return CURRENCY_SYMBOLS[moneda.toUpperCase()] || "$";
};
