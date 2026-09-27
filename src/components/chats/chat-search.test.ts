import { describe, expect, it } from 'vitest';
import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import { searchMessages } from './chat-search';

const base: WhatsAppChatMessage = { id: 'a', waMessageId: 'wa-a', direction: 'inbound', kind: 'text', textBody: 'Hola María', templateName: null, occurredAt: '2026-09-27T12:00:00Z', status: 'received', mediaId: null, mediaMimeType: null, mediaFilename: null, contextWaMessageId: null, reactionEmoji: null, payload: {} };

describe('searchMessages', () => {
  it('trims and matches text without case sensitivity', () => {
    expect(searchMessages([base, { ...base, id: 'b', textBody: 'MARÍA respondió' }, { ...base, id: 'c', textBody: null }], '  maría ')).toEqual(['a', 'b']);
  });

  it('returns no IDs for empty searches or reaction events', () => {
    expect(searchMessages([base], '  ')).toEqual([]);
    expect(searchMessages([{ ...base, kind: 'reaction' }], 'hola')).toEqual([]);
  });
});
