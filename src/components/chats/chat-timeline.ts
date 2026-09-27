import { differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';

export type TimelineItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'unread'; key: string; count: number }
  | { type: 'message'; key: string; message: WhatsAppChatMessage; continued: boolean };

// Mensajes seguidos del mismo lado dentro de este lapso se agrupan visualmente.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function dayLabel(date: Date, now: Date) {
  const diff = differenceInCalendarDays(now, date);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff > 1 && diff < 7) {
    const weekday = format(date, 'EEEE', { locale: es });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Arma la linea de tiempo del chat: separadores por dia, un aviso antes del
 * primer mensaje sin leer y marca de continuidad para agrupar burbujas.
 */
export function buildTimeline(
  messages: readonly WhatsAppChatMessage[],
  now: Date,
  unreadCount = 0
): TimelineItem[] {
  const items: TimelineItem[] = [];
  const inboundIndexes = messages.flatMap((message, index) => (message.direction === 'inbound' ? [index] : []));
  const firstUnreadIndex = unreadCount > 0 ? inboundIndexes[Math.max(0, inboundIndexes.length - unreadCount)] : undefined;

  messages.forEach((message, index) => {
    const date = new Date(message.occurredAt);
    const previous = messages[index - 1];
    const previousDate = previous ? new Date(previous.occurredAt) : null;
    const newDay = !previousDate || differenceInCalendarDays(date, previousDate) !== 0;

    if (newDay) items.push({ type: 'day', key: `day-${message.id}`, label: dayLabel(date, now) });
    if (index === firstUnreadIndex) items.push({ type: 'unread', key: `unread-${message.id}`, count: unreadCount });

    const continued = Boolean(
      previous
      && !newDay
      && index !== firstUnreadIndex
      && previous.direction === message.direction
      && date.getTime() - (previousDate?.getTime() ?? 0) < GROUP_WINDOW_MS
    );
    items.push({ type: 'message', key: message.id, message, continued });
  });

  return items;
}
