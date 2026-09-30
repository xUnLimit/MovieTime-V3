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

export type ReactionUsage = Record<string, number>;

export const REACTION_USAGE_KEY = 'chat-reaction-usage';

/** Emojis por uso (mas usado primero); a igual uso conservan el orden de `defaults`. */
export function orderReactions(defaults: readonly string[], usage: ReactionUsage): string[] {
  return defaults
    .map((emoji, index) => ({ emoji, index, count: usage[emoji] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map((item) => item.emoji);
}

export function bumpReaction(usage: ReactionUsage, emoji: string): ReactionUsage {
  return { ...usage, [emoji]: (usage[emoji] ?? 0) + 1 };
}

export function readReactionUsage(): ReactionUsage {
  try {
    const raw = localStorage.getItem(REACTION_USAGE_KEY);
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, count]) => typeof count === 'number' && Number.isFinite(count) && count > 0));
  } catch {
    return {};
  }
}

export function writeReactionUsage(usage: ReactionUsage): void {
  try {
    localStorage.setItem(REACTION_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // Sin almacenamiento (modo privado, cuota): el orden solo dura la sesion.
  }
}
