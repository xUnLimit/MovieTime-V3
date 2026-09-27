export const YAPPY_PARSER_VERSION = 1;

export type ParsedYappyMail =
  | { ok: true; payment: { amount: number; confirmationCode: string; payerNameShort: string; payerPhoneLast4: string; paidAt: string } }
  | { ok: false; reason: 'monto' | 'confirmacion' | 'telefono' | 'fecha' | 'nombre' };

const monthNumbers: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

export function parseYappyMail(source: string): ParsedYappyMail {
  if (source.length > 65_536) return { ok: false, reason: 'monto' };
  const text = source.replace(/[\u00a0\u202f]/g, ' ').replace(/\r/g, '');
  const amounts = [...text.matchAll(/\$\s*([\d,]+\.\d{2})\b/g)];
  if (amounts.length !== 1) return { ok: false, reason: 'monto' };
  const integerGroups = amounts[0][1].split('.')[0].split(',');
  if (integerGroups.length > 1 && (integerGroups[0].length < 1 || integerGroups[0].length > 3 ||
    integerGroups.slice(1).some((group) => group.length !== 3))) return { ok: false, reason: 'monto' };
  const confirmations = [...text.matchAll(/Confirmaci[oó]n\s+([A-Z0-9]+-[A-Z0-9]+)/gi)];
  if (confirmations.length !== 1) return { ok: false, reason: 'confirmacion' };
  const phones = [...text.matchAll(/\*{4}\s*[-–]?\s*(\d{4})\b/g)];
  if (phones.length !== 1) return { ok: false, reason: 'telefono' };
  const names = [...text.matchAll(/Enviado\s+por\s*\n\s*([^\n]+)\s*\n/gi)];
  if (names.length !== 1 || !names[0][1].trim()) return { ok: false, reason: 'nombre' };
  const dates = [...text.matchAll(/Fecha\s+(\d{1,2})\s+([a-záéíóú]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*([ap])\s*\.?\s*m\.?/gi)];
  if (dates.length !== 1) return { ok: false, reason: 'fecha' };
  const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw, meridiem] = dates[0];
  const month = monthNumbers[monthRaw.toLowerCase()];
  const day = Number(dayRaw);
  const year = Number(yearRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const localHour = hour % 12 + (meridiem.toLowerCase() === 'p' ? 12 : 0);
  const local = new Date(Date.UTC(year, (month ?? 0) - 1, day, localHour, minute));
  if (!month || day < 1 || hour < 1 || hour > 12 || minute > 59 ||
    local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day) {
    return { ok: false, reason: 'fecha' };
  }
  const amount = Number(amounts[0][1].replaceAll(',', ''));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999.99) return { ok: false, reason: 'monto' };
  return { ok: true, payment: {
    amount,
    confirmationCode: confirmations[0][1].trim().toUpperCase(),
    payerNameShort: names[0][1].trim(),
    payerPhoneLast4: phones[0][1],
    paidAt: new Date(local.getTime() + 5 * 60 * 60_000).toISOString(),
  } };
}
