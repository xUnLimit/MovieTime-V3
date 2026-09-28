import { buildMessageData, renderFreeText, type NoticeGroup } from '@/modules/messaging/message-data';
import {
  isUsableMetaTemplate,
  paramsFromData,
  type MetaTemplateInfo,
} from '@/modules/messaging/meta-template-mapping';
import { TEMPLATE_TIPOS } from '@/modules/messaging/template-tipos';
import { getSaludo } from '@/platform/utils/whatsapp';
import type { VentaMessageContext } from '@/platform/utils/whatsapp-template-render';
import type { TemplateMensaje, TipoTemplate } from '@/types';

// Un tipo del editor con su plantilla de Meta aprobada, listo para enviar desde el chat.
export type TemplateOption = { tipo: TemplateMensaje; meta: MetaTemplateInfo };

// Sin venta solo se puede rellenar lo que sale del nombre del cliente.
const NAME_ONLY_KEYS = ['saludo_nombre', 'nombre_cliente'];

function groupFrom(context: VentaMessageContext | null, fallbackName: string): NoticeGroup {
  const clienteNombre = context?.clienteNombre || fallbackName;
  return {
    clienteId: 'chat',
    clienteNombre,
    telefono: '',
    fechaVencimiento: context?.fechaVencimiento ?? null,
    moneda: 'USD',
    ventas: context ? [{
      ventaId: 'chat',
      clienteId: 'chat',
      clienteNombre,
      telefono: '',
      categoriaNombre: context.categoriaNombre,
      servicioNombre: context.servicioNombre,
      perfilNombre: context.perfilNombre,
      correo: context.correo,
      contrasena: context.contrasena,
      codigo: context.codigo,
      fechaVencimiento: context.fechaVencimiento,
      monto: context.monto,
      moneda: 'USD',
      activa: true,
      reembolsada: false,
      enReposo: false,
      promesaPagoHasta: null,
      respuestaCliente: null,
    }] : [],
  };
}

// Valores de la plantilla de Meta del tipo, en el orden de sus {{n}}, a partir de la venta.
export function buildMetaTemplateParams(
  tipo: Pick<TemplateMensaje, 'metaParamMap'>,
  context: VentaMessageContext | null,
  fallbackName: string,
  saludo: string = getSaludo(),
  now: Date = new Date(),
): string[] {
  const map = tipo.metaParamMap ?? [];
  const data = buildMessageData(groupFrom(context, fallbackName), { saludo, now });
  const params = paramsFromData(map, data);
  return context ? params : params.map((value, index) => (NAME_ONLY_KEYS.includes(map[index] ?? '') ? value : ''));
}

// Tipo del editor sugerido segun cuanto falta para el vencimiento.
export function suggestTipoByDueDate(fechaVencimiento: Date | null, now: Date): TipoTemplate {
  if (!fechaVencimiento) return 'notificacion_regular';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(fechaVencimiento.getFullYear(), fechaVencimiento.getMonth(), fechaVencimiento.getDate()).getTime();
  if (due < today) return 'cancelacion';
  if (due === today) return 'dia_pago';
  return 'notificacion_regular';
}

// Tipos activos cuya plantilla de Meta vinculada esta aprobada y vigente, en el orden del editor.
export function buildTemplateOptions(
  tipos: readonly TemplateMensaje[],
  metaTemplates: readonly MetaTemplateInfo[],
): TemplateOption[] {
  const order = new Map(TEMPLATE_TIPOS.map((item, index) => [item.value as string, index]));
  return tipos
    .flatMap((tipo) => {
      if (tipo.activo === false || !tipo.metaTemplateName) return [];
      const meta = metaTemplates.find((item) => item.name === tipo.metaTemplateName && isUsableMetaTemplate(item));
      return meta ? [{ tipo, meta }] : [];
    })
    .sort((a, b) => (order.get(a.tipo.tipo) ?? 99) - (order.get(b.tipo.tipo) ?? 99));
}

// Texto libre de un tipo del editor listo para insertar en el borrador. Sin venta solo se
// rellena el nombre; el resto de placeholders queda visible para completarlo a mano.
export function renderTipoForChat(
  tipo: Pick<TemplateMensaje, 'contenido'>,
  context: VentaMessageContext | null,
  fallbackName: string,
  now: Date = new Date(),
): string {
  const data = buildMessageData(groupFrom(context, fallbackName), { now });
  if (context) return renderFreeText(tipo.contenido, data);
  return tipo.contenido
    .replaceAll('{saludo}', data.saludo)
    .replaceAll('{cliente}', data.cliente)
    .replaceAll('{nombre_cliente}', data.nombre_cliente)
    .trim();
}
