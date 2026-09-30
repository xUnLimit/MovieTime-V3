import { describe, expect, it } from 'vitest';
import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import { afterEach, vi } from 'vitest';
import { REACTION_USAGE_KEY, bumpReaction, groupReactions, orderReactions, readReactionUsage, writeReactionUsage } from './chat-reactions';

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

describe('reaction usage order', () => {
  const defaults = ['👍', '❤️', '😂', '✅'];

  it('keeps the default order until something is used, then puts the most used first', () => {
    expect(orderReactions(defaults, {})).toEqual(defaults);
    expect(orderReactions(defaults, { '✅': 3, '😂': 1 })).toEqual(['✅', '😂', '👍', '❤️']);
  });

  it('breaks ties with the default order and ignores emojis that are not in the picker', () => {
    expect(orderReactions(defaults, { '❤️': 2, '👍': 2, '🔥': 9 })).toEqual(['👍', '❤️', '😂', '✅']);
  });

  it('counts a use without mutating the previous usage', () => {
    const before = { '✅': 1 };
    expect(bumpReaction(before, '✅')).toEqual({ '✅': 2 });
    expect(bumpReaction(before, '👍')).toEqual({ '✅': 1, '👍': 1 });
    expect(before).toEqual({ '✅': 1 });
  });
});

describe('reaction usage storage', () => {
  afterEach(() => vi.mocked(localStorage.getItem).mockReset());

  it('reads only valid counts and survives missing or corrupt storage', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ '✅': 2, '👍': 'x', '😂': -1, '❤️': 0 }));
    expect(readReactionUsage()).toEqual({ '✅': 2 });
    vi.mocked(localStorage.getItem).mockReturnValue('{no json');
    expect(readReactionUsage()).toEqual({});
    vi.mocked(localStorage.getItem).mockReturnValue('[1,2]');
    expect(readReactionUsage()).toEqual({});
    vi.mocked(localStorage.getItem).mockReturnValue(undefined as unknown as string);
    expect(readReactionUsage()).toEqual({});
    vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error('blocked'); });
    expect(readReactionUsage()).toEqual({});
  });

  it('writes the counts under a stable key and tolerates a full or blocked storage', () => {
    writeReactionUsage({ '✅': 2 });
    expect(localStorage.setItem).toHaveBeenCalledWith(REACTION_USAGE_KEY, '{"✅":2}');
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => { throw new Error('quota'); });
    expect(() => writeReactionUsage({ '✅': 3 })).not.toThrow();
  });
});
