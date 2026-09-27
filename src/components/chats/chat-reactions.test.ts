import { describe, expect, it } from 'vitest';
import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import { groupReactions } from './chat-reactions';

function reaction(id: string, direction: 'inbound' | 'outbound', emoji: string | null, target = 'original'): WhatsAppChatMessage {
  return { id, waMessageId: id, direction, kind: 'reaction', textBody: null, templateName: null, occurredAt: '2026-09-27T12:00:00Z', status: 'read', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: target, reactionEmoji: emoji, payload: {} };
}

describe('groupReactions', () => {
  it('groups both directions by the target WhatsApp ID', () => {
    expect(groupReactions([reaction('a', 'outbound', '👍'), reaction('b', 'inbound', '❤️')]).get('original')).toEqual({ mine: '👍', theirs: '❤️' });
  });

  it('uses the latest reaction and removes an empty one without affecting the other side', () => {
    const result = groupReactions([reaction('a', 'outbound', '👍'), reaction('b', 'outbound', '😂'), reaction('c', 'inbound', '❤️'), reaction('d', 'outbound', '')]);
    expect(result.get('original')).toEqual({ theirs: '❤️' });
    expect(groupReactions([reaction('a', 'outbound', '👍'), reaction('b', 'outbound', '')]).size).toBe(0);
  });

  it('ignores unrelated messages and reactions without a target', () => {
    expect(groupReactions([{ ...reaction('a', 'inbound', '👍'), kind: 'text' }, reaction('b', 'inbound', '👍', '')]).size).toBe(0);
  });
});
