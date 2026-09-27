import {
  formatMonto,
  formatVencimiento,
  greetingFor,
  type VentaMessageContext,
} from '@/platform/utils/whatsapp-template-render';
import type { TemplateMensaje } from '@/types';
import { CHAT_TEMPLATES, type ChatTemplate } from './chat-format';

// Valores de cada plantilla de Meta en el orden de sus {{n}}, a partir de la venta.
export function buildMetaTemplateParams(
  name: ChatTemplate['name'],
  context: VentaMessageContext | null,
  fallbackName: string,
  saludo?: string
): string[] {
  const greeting = greetingFor(context?.clienteNombre || fallbackName, saludo);
  if (!context) {
    const template = CHAT_TEMPLATES.find((item) => item.name === name) ?? CHAT_TEMPLATES[0];
    return template.params.map((param) => (param === 'Saludo y nombre' ? greeting : ''));
  }

  const servicio = context.categoriaNombre;
  const fecha = formatVencimiento(context.fechaVencimiento);
  const monto = formatMonto(context.monto);
  if (name === 'vence_hoy') return [servicio, fecha, monto];
  return [greeting, servicio, fecha, monto];
}

// Plantilla de Meta sugerida segun cuanto falta para el vencimiento.
export function suggestMetaTemplate(fechaVencimiento: Date | null, now: Date): ChatTemplate['name'] {
  if (!fechaVencimiento) return 'recordatorio_vencimiento';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(fechaVencimiento.getFullYear(), fechaVencimiento.getMonth(), fechaVencimiento.getDate()).getTime();
  if (due < today) return 'servicio_suspendido';
  if (due === today) return 'vence_hoy';
  return 'recordatorio_vencimiento';
}

export const QUICK_REPLY_ORDER: TemplateMensaje['tipo'][] = [
  'notificacion_regular',
  'dia_pago',
  'renovacion',
  'suscripcion',
  'actualizacion_credenciales',
  'transferencia_servicio',
  'cancelacion',
];

export const QUICK_REPLY_LABELS: Record<TemplateMensaje['tipo'], string> = {
  notificacion_regular: 'Recordatorio de pago',
  dia_pago: 'Día de pago',
  renovacion: 'Renovación exitosa',
  suscripcion: 'Datos de acceso',
  actualizacion_credenciales: 'Actualización de credenciales',
  transferencia_servicio: 'Transferencia de servicio',
  cancelacion: 'Corte de servicio',
};

// Una respuesta por tipo: la plantilla activa mas reciente del editor.
export function quickRepliesFrom(templates: readonly TemplateMensaje[]) {
  return QUICK_REPLY_ORDER.flatMap((tipo) => {
    const template = templates.find((item) => item.tipo === tipo && item.activo !== false);
    return template ? [{ tipo, label: QUICK_REPLY_LABELS[tipo], contenido: template.contenido }] : [];
  });
}
