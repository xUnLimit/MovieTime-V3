import { calcularDiasRelativosCalendario } from '@/platform/utils/calculations';
import type { VentaDoc } from '@/types';

export function getVentaEstadoDisplay(venta: VentaDoc | null) {
  if (!venta) {
    return {
      className: 'border-muted-foreground/40 bg-muted text-muted-foreground',
      text: '-',
    };
  }

  if ((venta.estado ?? 'activo') === 'inactivo') {
    return {
      className: 'border-warning-border bg-warning-subtle text-warning',
      text: 'Inactiva',
    };
  }

  const dias = venta.fechaFin
    ? calcularDiasRelativosCalendario(venta.fechaFin)
    : null;
  if (dias === null) {
    return {
      className: 'border-success-border bg-success-subtle text-success',
      text: 'Activa',
    };
  }
  if (dias < 0) {
    const d = Math.abs(dias);
    return {
      className: 'border-danger-border bg-danger-subtle text-danger',
      text: `${d} dia${d !== 1 ? 's' : ''} vencida`,
    };
  }
  if (dias === 0) {
    return {
      className: 'border-danger-border bg-danger-subtle text-danger',
      text: 'Vence hoy',
    };
  }
  if (dias <= 7) {
    return {
      className: 'border-warning-border bg-warning-subtle text-warning',
      text: `${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`,
    };
  }
  return {
    className: 'border-success-border bg-success-subtle text-success',
    text: `${dias} dias restantes`,
  };
}
