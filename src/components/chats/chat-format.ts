import { format, isSameDay, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';

const WINDOW_MS = 24 * 60 * 60 * 1000;

export const CHAT_TEMPLATES = [
  {
    name: 'recordatorio_vencimiento',
    label: 'Recordatorio de pago',
    params: ['Saludo y nombre', 'Servicio', 'Fecha de vencimiento', 'Monto'],
  },
  {
    name: 'vence_hoy',
    label: 'Vence hoy',
    params: ['Servicio', 'Fecha de vencimiento', 'Monto'],
  },
  {
    name: 'servicio_suspendido',
    label: 'Corte de servicio',
    params: ['Saludo y nombre', 'Servicio', 'Fecha de vencimiento', 'Monto'],
  },
] as const;

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
  image: '📷 Imagen',
  audio: '🎤 Audio',
  video: '🎥 Video',
  document: '📄 Documento',
  sticker: 'Sticker',
  location: '📍 Ubicación',
  contacts: '👤 Contacto',
};

export function messagePreview(kind: string, textBody: string | null, templateName: string | null) {
  if (textBody) return textBody;
  if (templateName) {
    const template = CHAT_TEMPLATES.find((item) => item.name === templateName);
    return `Plantilla: ${template?.label ?? templateName}`;
  }
  return KIND_PREVIEWS[kind] ?? 'Mensaje no compatible';
}
