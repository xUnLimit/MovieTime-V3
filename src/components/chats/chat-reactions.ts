import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';

export type MessageReactions = { mine?: string; theirs?: string };

export function groupReactions(messages: WhatsAppChatMessage[]): Map<string, MessageReactions> {
  const grouped = new Map<string, MessageReactions>();
  for (const message of messages) {
    if (message.kind !== 'reaction' || !message.contextWaMessageId) continue;
    const side = message.direction === 'outbound' ? 'mine' : 'theirs';
    const current = grouped.get(message.contextWaMessageId) ?? {};
    if (message.reactionEmoji) {
      grouped.set(message.contextWaMessageId, { ...current, [side]: message.reactionEmoji });
    } else {
      delete current[side];
      if (current.mine || current.theirs) grouped.set(message.contextWaMessageId, current);
      else grouped.delete(message.contextWaMessageId);
    }
  }
  return grouped;
}
