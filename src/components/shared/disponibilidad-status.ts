/**
 * Color de texto segun la disponibilidad de perfiles de un servicio: poco (rojo), medio (advertencia) o
 * bastante (verde). Fuente unica para los formularios de venta y el dialogo de traspaso.
 */
export function getDisponiblesColorClass(disponibles: number, total: number): string {
  if (total <= 0) return 'text-muted-foreground';
  const ratio = disponibles / total;
  if (ratio <= 0.25) return 'text-danger';
  if (ratio <= 0.5) return 'text-warning';
  return 'text-success';
}
