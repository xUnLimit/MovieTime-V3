import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { conversationTitle, getServiceWindow } from './chat-format';

export const CHAT_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'no_leidos', label: 'No leídos' },
  { id: 'ventana_abierta', label: 'Ventana abierta' },
  { id: 'sin_registrar', label: 'Sin registrar' },
] as const;

export type ChatFilter = (typeof CHAT_FILTERS)[number]['id'];

// Vencimiento cercano (se marca en la lista): desde hace una semana hasta dentro de tres dias.
const DUE_SOON_DAYS = 3;
const OVERDUE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function daysUntil(date: Date, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((date.getTime() - today.getTime()) / DAY_MS);
}

export function isDueSoon(conversation: Pick<WhatsAppConversation, 'nextExpiry'>, now: Date) {
  const expiry = parseDateOnly(conversation.nextExpiry);
  if (!expiry) return false;
  const days = daysUntil(expiry, now);
  return days <= DUE_SOON_DAYS && days >= -OVERDUE_DAYS;
}

export function matchesFilter(conversation: WhatsAppConversation, filter: ChatFilter, now: Date) {
  switch (filter) {
    case 'no_leidos':
      return conversation.unreadCount > 0;
    case 'ventana_abierta':
      return getServiceWindow(conversation.lastInboundAt, now).open;
    case 'sin_registrar':
      return !conversation.terceroId;
    default:
      return true;
  }
}

export function matchesSearch(conversation: WhatsAppConversation, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  const digits = term.replace(/\D/g, '');
  return conversationTitle(conversation).toLowerCase().includes(term)
    || (digits.length > 0 && conversation.waId.includes(digits))
    || conversation.lastPreview.toLowerCase().includes(term);
}

export function countByFilter(conversations: readonly WhatsAppConversation[], now: Date) {
  return Object.fromEntries(
    CHAT_FILTERS.map((filter) => [filter.id, conversations.filter((item) => matchesFilter(item, filter.id, now)).length])
  ) as Record<ChatFilter, number>;
}
