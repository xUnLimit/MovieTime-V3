import type { Tone } from './tone';

type StatusTone = Extract<Tone, 'success' | 'warning' | 'danger' | 'info'>;

export interface EstadoVencimiento {
  tone: StatusTone;
  text: string;
}

const plural = (n: number, singular: string, pluralForm: string) => (n === 1 ? singular : pluralForm);

/**
 * Estado de vencimiento de una venta o servicio segun sus dias restantes (negativo = retraso).
 * Fuente unica para tablas, campana y dialogos de Notificaciones y Servicios.
 * `resaltada` marca seguimientos manuales: el estado urgente se muestra como advertencia.
 */
export function getEstadoVencimiento(diasRestantes: number, resaltada = false): EstadoVencimiento {
  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes);
    return { tone: resaltada ? 'warning' : 'danger', text: `${dias} ${plural(dias, 'día', 'días')} de retraso` };
  }
  if (diasRestantes === 0) {
    return { tone: resaltada ? 'warning' : 'danger', text: 'Vence hoy' };
  }
  if (diasRestantes <= 7) {
    return {
      tone: 'warning',
      text: `${diasRestantes} ${plural(diasRestantes, 'día restante', 'días restantes')}`,
    };
  }
  return { tone: resaltada ? 'warning' : 'success', text: `${diasRestantes} días restantes` };
}

const BADGE_CLASS: Record<StatusTone, string> = {
  success: 'border-success-border bg-success-subtle text-success',
  warning: 'border-warning-border bg-warning-subtle text-warning',
  danger: 'border-danger-border bg-danger-subtle text-danger',
  info: 'border-info-border bg-info-subtle text-info',
};

/** Clases de un Badge outline para el estado de vencimiento. */
export function getEstadoBadge(diasRestantes: number, resaltada: boolean): { variant: string; text: string } {
  const { tone, text } = getEstadoVencimiento(diasRestantes, resaltada);
  return { variant: BADGE_CLASS[tone], text };
}

/** Colores del icono de campana: rojo si ya vencio o vence hoy, advertencia en cualquier otro caso. */
export function getBellIconColor(diasRestantes: number): {
  bgColor: string;
  hoverBgColor: string;
  textColor: string;
} {
  if (diasRestantes <= 0) {
    return { bgColor: 'bg-danger-subtle', hoverBgColor: 'hover:bg-danger/15', textColor: 'text-danger' };
  }
  return { bgColor: 'bg-warning-subtle', hoverBgColor: 'hover:bg-warning/15', textColor: 'text-warning' };
}
