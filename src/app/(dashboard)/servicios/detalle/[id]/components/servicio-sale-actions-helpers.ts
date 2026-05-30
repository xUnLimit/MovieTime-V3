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
      className: 'border-orange-500/40 bg-orange-950/30 text-orange-400',
      text: 'Inactiva',
    };
  }

  const dias = venta.fechaFin
    ? calcularDiasRelativosCalendario(venta.fechaFin)
    : null;
  if (dias === null) {
    return {
      className: 'border-green-500/40 bg-green-950/30 text-green-400',
      text: 'Activa',
    };
  }
  if (dias < 0) {
    const d = Math.abs(dias);
    return {
      className: 'border-red-500/50 bg-red-950/30 text-red-400',
      text: `${d} dia${d !== 1 ? 's' : ''} vencida`,
    };
  }
  if (dias === 0) {
    return {
      className: 'border-red-500/50 bg-red-950/30 text-red-400',
      text: 'Vence hoy',
    };
  }
  if (dias <= 7) {
    return {
      className: 'border-yellow-500/50 bg-yellow-950/30 text-yellow-400',
      text: `${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`,
    };
  }
  return {
    className: 'border-green-500/40 bg-green-950/30 text-green-400',
    text: `${dias} dias restantes`,
  };
}
