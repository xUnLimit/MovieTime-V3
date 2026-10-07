'use client';

import { MessageTimeline } from '@/components/chats/MessageTimeline';
import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';

const NOW = new Date('2026-10-06T16:00:00Z');
const MESSAGES: WhatsAppChatMessage[] = Array.from({ length: 36 }, (_, i) => ({
  id: `preview-${i}`, waMessageId: `preview-wa-${i}`, direction: i % 2 ? 'outbound' : 'inbound', kind: 'text',
  textBody: `Mensaje de ejemplo ${i + 1}. Estoy explicando el problema con el servicio para que el equipo pueda revisarlo.`,
  occurredAt: new Date(NOW.getTime() - (3 - Math.floor(i / 12)) * 86400000 + (i % 12) * 60000).toISOString(),
  templateName: null, status: 'read', mediaId: null, mediaMimeType: null, mediaFilename: null,
  contextWaMessageId: null, reactionEmoji: null, payload: {},
}));

export function ChatTimelinePreview() {
  return <div className="chats-surface flex h-[calc(100dvh-10rem)] min-h-80 flex-col overflow-hidden rounded-xl border bg-chat-canvas">
    <MessageTimeline messages={MESSAGES} isLoading={false} unreadCount={0} now={NOW} onReact={() => undefined} onReply={() => undefined} />
  </div>;
}
