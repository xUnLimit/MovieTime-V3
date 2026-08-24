const PANAMA_TIME_ZONE = 'America/Panama';
const SHORT_MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
] as const;

export type PaymentPromiseState = 'active' | 'today' | 'overdue';

export type PaymentPromiseDisplay = {
  state: PaymentPromiseState;
  text: string;
};

export function getPanamaTomorrow(now = new Date()): Date {
  const { day, month, year } = getPanamaDateParts(now);
  return new Date(year, month - 1, day + 1);
}

export function isValidPaymentPromiseDate(date: Date, now = new Date()): boolean {
  return toLocalDateKey(date) >= toLocalDateKey(getPanamaTomorrow(now));
}

export function getPaymentPromiseDisplay(
  promisedDate: Date,
  now = new Date(),
): PaymentPromiseDisplay {
  const promisedKey = toLocalDateKey(promisedDate);
  const todayKey = toPanamaDateKey(now);

  if (promisedKey < todayKey) {
    return {
      state: 'overdue',
      text: `Promesa vencida · ${formatShortDate(promisedDate)}`,
    };
  }

  if (promisedKey === todayKey) {
    return { state: 'today', text: 'Pago prometido hoy' };
  }

  return {
    state: 'active',
    text: `Pago prometido · ${formatShortDate(promisedDate)}`,
  };
}

function getPanamaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: PANAMA_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    day: Number(values.day),
    month: Number(values.month),
    year: Number(values.year),
  };
}

function toPanamaDateKey(date: Date): string {
  const { day, month, year } = getPanamaDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatShortDate(date: Date): string {
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
}
