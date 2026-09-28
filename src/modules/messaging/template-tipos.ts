export type TemplateTipoKey =
  | 'notificacion_regular'
  | 'dia_pago'
  | 'renovacion'
  | 'suscripcion'
  | 'cancelacion'
  | 'actualizacion_credenciales'
  | 'transferencia_servicio'
  | 'datos_pago'
  | 'despedida';

export const TEMPLATE_TIPOS: readonly { value: TemplateTipoKey; label: string }[] = [
  { value: 'notificacion_regular', label: 'Notificación Regular' },
  { value: 'dia_pago', label: 'Notificación Día de Pago' },
  { value: 'renovacion', label: 'Notificación de Renovación' },
  { value: 'suscripcion', label: 'Notificación de Suscripción' },
  { value: 'cancelacion', label: 'Cancelación de Servicio' },
  { value: 'actualizacion_credenciales', label: 'Actualización de Credenciales' },
  { value: 'transferencia_servicio', label: 'Transferencia de Servicio' },
  { value: 'datos_pago', label: 'Datos de pago' },
  { value: 'despedida', label: 'Despedida' },
];

export function tipoLabel(tipo: string): string {
  return TEMPLATE_TIPOS.find((item) => item.value === tipo)?.label ?? tipo;
}
