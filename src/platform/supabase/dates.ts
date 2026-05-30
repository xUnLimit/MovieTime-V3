export function convertTimestamps<T>(value: T): T {
  return reviveDates(value);
}

export function timestampToDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dateOnlyToLocalDate(value);
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export function toIso(value: unknown) {
  const date = timestampToDate(value);
  return date.toISOString();
}

export function toDateOnly(value: unknown) {
  const date = timestampToDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toNullableDateOnly(value: unknown) {
  if (!value) return null;
  return toDateOnly(value);
}

export function reviveDates<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(reviveDates) as T;

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (typeof nested === 'string' && shouldReviveDate(key, nested)) {
      result[key] = /^\d{4}-\d{2}-\d{2}$/.test(nested)
        ? dateOnlyToLocalDate(nested)
        : new Date(nested);
    } else {
      result[key] = reviveDates(nested);
    }
  }
  return result as T;
}

function dateOnlyToLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shouldReviveDate(key: string, value: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  return (
    key.endsWith('At') ||
    key.startsWith('fecha') ||
    key.includes('Fecha') ||
    key.startsWith('periodo') ||
    key.endsWith('Inicio') ||
    key.endsWith('Fin') ||
    key.endsWith('Vencimiento') ||
    key === 'timestamp'
  );
}
