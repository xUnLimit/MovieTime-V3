import type { VentaDoc } from '@/types';

import type { NotificacionVentaConId } from './types';

export const ESTADO_FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'proximas', label: 'Próximas a vencer' },
  { value: 'dia_pago', label: 'Día de pago' },
  { value: 'vencidas', label: 'Vencidas' },
] as const;

export const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

export function getBellIconColor(diasRestantes: number): {
  bgColor: string;
  hoverBgColor: string;
  textColor: string;
} {
  if (diasRestantes <= 0) {
    return {
      bgColor: 'bg-red-100 dark:bg-red-500/20',
      hoverBgColor: 'hover:bg-red-200 dark:hover:bg-red-500/30',
      textColor: 'text-red-600 dark:text-red-400',
    };
  } else if (diasRestantes >= 1 && diasRestantes <= 7) {
    return {
      bgColor: 'bg-yellow-100 dark:bg-yellow-500/20',
      hoverBgColor: 'hover:bg-yellow-200 dark:hover:bg-yellow-500/30',
      textColor: 'text-yellow-600 dark:text-yellow-400',
    };
  }

  return {
    bgColor: 'bg-yellow-100 dark:bg-yellow-500/20',
    hoverBgColor: 'hover:bg-yellow-200 dark:hover:bg-yellow-500/30',
    textColor: 'text-yellow-600 dark:text-yellow-400',
  };
}

export function getEstadoBadge(
  diasRestantes: number,
  resaltada: boolean
): { variant: string; text: string } {
  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes);
    return {
      variant: resaltada
        ? 'border-orange-500/50 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
        : 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
      text: `${dias} día${dias > 1 ? 's' : ''} de retraso`,
    };
  } else if (diasRestantes === 0) {
    return {
      variant: resaltada
        ? 'border-orange-500/50 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
        : 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
      text: 'Vence hoy',
    };
  } else if (diasRestantes <= 7) {
    return {
      variant: resaltada
        ? 'border-orange-500/50 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
        : 'border-yellow-500/50 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
      text: `${diasRestantes} día${diasRestantes > 1 ? 's' : ''} restante${diasRestantes > 1 ? 's' : ''}`,
    };
  }

  return {
    variant: resaltada
      ? 'border-orange-500/50 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
      : 'border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
    text: `${diasRestantes} día${diasRestantes > 1 ? 's' : ''} restante${diasRestantes > 1 ? 's' : ''}`,
  };
}

export function formatearFecha(fecha: Date): string {
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];

  const dia = fecha.getDate();
  const mes = meses[fecha.getMonth()];
  const anio = fecha.getFullYear();

  return `${dia} de ${mes} del ${anio}`;
}

export function toVentaDocFromNotification(
  notif: NotificacionVentaConId,
): VentaDoc {
  return {
    id: notif.ventaId,
    clienteId: notif.clienteId,
    clienteNombre: notif.clienteNombre,
    categoriaId: notif.categoriaId || '',
    categoriaNombre: notif.categoriaNombre,
    servicioId: notif.servicioId,
    servicioNombre: notif.servicioNombre,
    servicioCorreo: notif.servicioCorreo,
    servicioContrasena: notif.servicioContrasena,
    clienteTelefono: notif.clienteTelefono,
    perfilNombre: notif.perfilNombre,
    codigo: notif.codigo,
    notas: notif.notas,
    metodoPagoId: notif.metodoPagoId,
    moneda: notif.moneda,
    precioFinal: notif.precioFinal,
    estado: 'activo',
  } as VentaDoc;
}
