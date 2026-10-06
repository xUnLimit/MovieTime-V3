type TemplateTipoKey =
  | 'notificacion_regular'
  | 'dia_pago'
  | 'renovacion'
  | 'suscripcion'
  | 'cancelacion'
  | 'actualizacion_credenciales'
  | 'transferencia_servicio'
  | 'datos_pago'
  | 'datos_acceso'
  | 'despedida';

export type EditableTipoKey = Exclude<TemplateTipoKey, 'notificacion_regular'>;

// notificacion_regular sigue en el enum solo por historial; ya no se edita ni se envia.
export const TEMPLATE_TIPOS: readonly { value: EditableTipoKey; label: string; cuando: string }[] = [
  { value: 'dia_pago', label: 'Aviso de vencimiento', cuando: 'antes y el día que vence' },
  { value: 'renovacion', label: 'Notificación de Renovación', cuando: 'al registrar una renovación' },
  { value: 'suscripcion', label: 'Notificación de Suscripción', cuando: 'al crear una venta' },
  { value: 'cancelacion', label: 'Aviso de corte', cuando: 'al darle Notificar y elegir Cancelación (al cortar una venta no se envía nada)' },
  { value: 'actualizacion_credenciales', label: 'Actualización de Credenciales', cuando: 'al cambiar datos de acceso' },
  { value: 'transferencia_servicio', label: 'Transferencia de Servicio', cuando: 'al mover a otra cuenta' },
  { value: 'datos_pago', label: 'Datos de pago', cuando: 'cuando el cliente toca un botón de renovar' },
  { value: 'datos_acceso', label: 'Datos de acceso solicitados', cuando: 'cuando el cliente solicita sus datos de acceso' },
  { value: 'despedida', label: 'Despedida', cuando: 'cuando toca "No continuar"' },
];

export const TEMPLATE_GROUPS: readonly { id: string; label: string; tipos: readonly EditableTipoKey[] }[] = [
  { id: 'cobros', label: 'Cobros', tipos: ['dia_pago', 'cancelacion'] },
  { id: 'respuestas', label: 'Respuestas automáticas', tipos: ['datos_pago', 'datos_acceso', 'despedida'] },
  { id: 'ventas', label: 'Ventas', tipos: ['suscripcion', 'renovacion'] },
  { id: 'cuentas', label: 'Cuentas', tipos: ['actualizacion_credenciales', 'transferencia_servicio'] },
];

/** Reconoce un tipo editable; sirve para validar entradas externas como `?tipo=` en la URL. */
export function isEditableTipo(value: unknown): value is EditableTipoKey {
  return typeof value === 'string' && TEMPLATE_TIPOS.some((item) => item.value === value);
}

export function tipoLabel(tipo: string): string {
  return TEMPLATE_TIPOS.find((item) => item.value === tipo)?.label ?? tipo;
}

export function tipoCuando(tipo: string): string {
  return TEMPLATE_TIPOS.find((item) => item.value === tipo)?.cuando ?? '';
}
