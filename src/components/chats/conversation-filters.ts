import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { conversationTitle, getServiceWindow } from './chat-format';

// Filtros siempre visibles; "ventana_abierta" y las categorias por servicio
// viven en el desplegable, para no saturar la barra.
export const CHAT_FIXED_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'no_leidos', label: 'No leídos' },
  { id: 'sin_registrar', label: 'Sin registrar' },
] as const;

export const CHAT_MORE_FILTERS = [
  { id: 'ventana_abierta', label: 'Ventana abierta' },
] as const;

export type ChatFixedFilter = (typeof CHAT_FIXED_FILTERS)[number]['id'] | (typeof CHAT_MORE_FILTERS)[number]['id'];
export type ChatCategoryFilter = `categoria:${string}`;
export type ChatFilter = ChatFixedFilter | ChatCategoryFilter;

export function categoryFilterId(categoryName: string): ChatCategoryFilter {
  return `categoria:${categoryName}`;
}

export function categoryFromFilter(filter: ChatFilter): string | null {
  return filter.startsWith('categoria:') ? filter.slice('categoria:'.length) : null;
}

// Categorias con al menos un cliente activo en este momento, en orden
// alfabetico: la etiqueta es automatica, no hay catalogo que mantener a mano.
export function activeConversationCategories(conversations: readonly WhatsAppConversation[]): string[] {
  const names = new Set<string>();
  for (const conversation of conversations) {
    for (const name of conversation.activeCategories) names.add(name);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
}

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
  const category = categoryFromFilter(filter);
  if (category !== null) return conversation.activeCategories.includes(category);
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

export function countByFilter(conversations: readonly WhatsAppConversation[], now: Date): Record<string, number> {
  const filters: ChatFilter[] = [
    ...CHAT_FIXED_FILTERS.map((item) => item.id),
    ...CHAT_MORE_FILTERS.map((item) => item.id),
    ...activeConversationCategories(conversations).map(categoryFilterId),
  ];
  return Object.fromEntries(
    filters.map((filter) => [filter, conversations.filter((item) => matchesFilter(item, filter, now)).length])
  );
}
