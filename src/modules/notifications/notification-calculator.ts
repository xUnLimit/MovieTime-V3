export type NotificationPriority = 'baja' | 'media' | 'alta' | 'critica';
export type ExpirationEntity = 'venta' | 'servicio';

export function calcularPrioridad(diasRestantes: number): NotificationPriority {
  if (diasRestantes <= 0) return 'critica';
  if (diasRestantes <= 3) return 'alta';
  if (diasRestantes <= 7) return 'media';
  return 'baja';
}

export function generarTitulo(diasRestantes: number, entidad: ExpirationEntity): string {
  if (diasRestantes < 0) {
    const diasVencidos = Math.abs(diasRestantes);
    return entidad === 'venta'
      ? `Venta vencida hace ${diasVencidos} día${diasVencidos > 1 ? 's' : ''}`
      : `Servicio vencido hace ${diasVencidos} día${diasVencidos > 1 ? 's' : ''}`;
  }

  if (diasRestantes === 0) {
    return entidad === 'venta' ? 'Venta vence hoy ⚠️' : 'Servicio vence hoy ⚠️';
  }

  return entidad === 'venta'
    ? `Venta vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`
    : `Servicio vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`;
}
