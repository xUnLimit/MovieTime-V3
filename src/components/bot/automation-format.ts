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

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
