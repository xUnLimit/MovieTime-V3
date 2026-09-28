import { format, isSameDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';

const WINDOW_MS = 24 * 60 * 60 * 1000;

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
  if (isSameDay(date, subDays(now, 1))) return 'ayer';
  return format(date, 'dd/MM/yy', { locale: es });
}

export type ServiceWindow = { open: false } | { open: true; hoursLeft: number };

export function getServiceWindow(lastInboundAt: string | null, now: Date): ServiceWindow {
  if (!lastInboundAt) return { open: false };
  // Si el reloj del dispositivo esta desincronizado, "lastInboundAt" puede
  // quedar en el futuro respecto a "now": la ventana igual esta abierta, asi
  // que se acota el restante a las 24h completas en vez de cerrarla.
  const remaining = Math.min(WINDOW_MS, new Date(lastInboundAt).getTime() + WINDOW_MS - now.getTime());
  if (remaining <= 0) return { open: false };
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
  if (templateName) return `Plantilla: ${templateName}`;
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
