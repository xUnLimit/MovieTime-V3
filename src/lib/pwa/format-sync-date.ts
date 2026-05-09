export function formatSyncDate(date: Date | null): string {
  if (!date) return 'Sin copia offline';
  return date.toLocaleString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}
