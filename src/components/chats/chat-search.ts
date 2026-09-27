import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';

export function searchMessages(messages: WhatsAppChatMessage[], query: string): string[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [];
  return messages.filter((message) => message.kind !== 'reaction' && message.textBody?.toLocaleLowerCase().includes(term)).map((message) => message.id);
}
