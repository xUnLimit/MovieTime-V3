import { format, isSameDay, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Textos registrados en Meta; solo se usan para la vista previa antes de enviar.
export const CHAT_TEMPLATES = [
  {
    name: 'recordatorio_vencimiento',
    label: 'Recordatorio de pago',
    params: ['Saludo y nombre', 'Servicio', 'Fecha de vencimiento', 'Monto'],
    body: '⏳ *Recordatorio de pago*\n\n{{1}}. Te escribimos solamente para recordarte que el pago de tu suscripción a *{{2}}* está próximo a vencer.\n\n📅 *Fecha de vencimiento:* {{3}}\n💵 *Monto:* {{4}}\n\n💳 Puedes realizar tu pago desde antes para asegurar la continuidad del servicio o hacerlo el día de vencimiento.\n\n🕒 Si necesitas más tiempo, notifícanos antes del vencimiento para evitar la desconexión automática.\n\n❌ Si no deseas continuar con el servicio, por favor infórmanos. Si no recibimos respuesta, entenderemos que no deseas seguir y procederemos con la suspensión del acceso y la eliminación del perfil.\n\n¡Gracias por tu confianza y preferirnos!\n\n*— MovieTime PTY*',
  },
  {
    name: 'vence_hoy',
    label: 'Vence hoy',
    params: ['Servicio', 'Fecha de vencimiento', 'Monto'],
    body: '⚠️ *Recordatorio de renovación - {{1}}*\n\n📅 *Fecha de vencimiento:* {{2}}\n💵 *Monto:* {{3}}\n\n❌ Si no deseas continuar con el servicio, por favor infórmanos.\n\n✅ Si deseas continuar con el servicio, puedes realizar el pago al siguiente Yappy:\nAllan Ordoñez\n6769-4145\n\n❗ Si no recibimos ningún tipo de respuesta antes de finalizar el día, entenderemos que no deseas continuar y procederemos con la suspensión del servicio y eliminación del perfil.\n\n¡Gracias por tu confianza y por preferirnos! Quedamos atentos a tu respuesta.\n\n*— MovieTime PTY*',
  },
  {
    name: 'servicio_suspendido',
    label: 'Corte de servicio',
    params: ['Saludo y nombre', 'Servicio', 'Fecha de vencimiento', 'Monto'],
    body: '❗ *Corte de servicio*\n\n{{1}}. Debido a que no hemos recibido respuesta de su parte, su acceso a la plataforma de *{{2}}* será suspendido en breve.\n\n📅 *Fecha de vencimiento:* {{3}}\n💵 *Monto:* {{4}}\n\nPara continuar disfrutando del servicio, te invitamos a realizar el pago correspondiente y enviarnos el comprobante. Una vez recibido, reactivaremos tu acceso lo más pronto posible.\n\n¡Gracias por tu confianza y por preferirnos! 😊\n\n*— MovieTime PTY*',
  },
] as const;

export function renderTemplatePreview(body: string, params: readonly string[]) {
  return body.replace(/\{\{(\d)\}\}/g, (match, index: string) => params[Number(index) - 1]?.trim() || match);
}

export type ChatTemplate = (typeof CHAT_TEMPLATES)[number];

export function conversationTitle(conversation: Pick<WhatsAppConversation, 'terceroNombre' | 'contactName' | 'waId'>) {
  return conversation.terceroNombre || conversation.contactName || formatWaId(conversation.waId);
}

// 50765331751 -> +507 6533-1751; otros paises se muestran con prefijo +.
export function formatWaId(waId: string) {
  const panama = /^507(\d{4})(\d{4})$/.exec(waId);
  return panama ? `+507 ${panama[1]}-${panama[2]}` : `+${waId}`;
}

export function formatChatTime(iso: string, now: Date) {
  const date = new Date(iso);
  if (isSameDay(date, now)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'ayer';
  return format(date, 'dd/MM/yy', { locale: es });
}

export type ServiceWindow = { open: false } | { open: true; hoursLeft: number };

export function getServiceWindow(lastInboundAt: string | null, now: Date): ServiceWindow {
  if (!lastInboundAt) return { open: false };
  const remaining = new Date(lastInboundAt).getTime() + WINDOW_MS - now.getTime();
  if (remaining <= 0 || remaining > WINDOW_MS) return { open: false };
  return { open: true, hoursLeft: Math.max(1, Math.floor(remaining / (60 * 60 * 1000))) };
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Enviando',
  accepted: 'Enviado',
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leído',
  failed: 'No entregado',
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

const KIND_PREVIEWS: Record<string, string> = {
  image: 'Imagen',
  audio: 'Audio',
  video: 'Video',
  document: 'Documento',
  sticker: 'Sticker',
  location: 'Ubicación',
  contacts: 'Contacto',
  reaction: 'Reaccionó',
  interactive: 'Mensaje interactivo',
  buttons: 'Mensaje interactivo',
  list: 'Mensaje interactivo',
};

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export function messagePreview(kind: string, textBody: string | null, templateName: string | null) {
  if (textBody) return textBody;
  if (templateName) {
    const template = CHAT_TEMPLATES.find((item) => item.name === templateName);
    return `Plantilla: ${template?.label ?? templateName}`;
  }
  return KIND_PREVIEWS[kind] ?? 'Mensaje no compatible';
}

export function initialsFor(name: string) {
  const letters = name
    .replace(/[^\p{L}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase());
  return letters.join('') || '#';
}

// Tono estable por contacto (0-359) para distinguir avatares sin fotos.
export function avatarHue(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}
