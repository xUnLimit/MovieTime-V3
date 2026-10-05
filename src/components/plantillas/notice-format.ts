const LOCALE = 'es-PA';

export function formatDateTime(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '—';
  return new Date(time).toLocaleString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDay(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '—' : new Date(time).toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatClock(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '' : new Date(time).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

/** "1 enviado", "3 enviados": el conteo con la palabra en singular o plural. */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
