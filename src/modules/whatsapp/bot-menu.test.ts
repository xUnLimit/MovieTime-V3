import { describe, expect, it } from 'vitest';
import { sendWhatsAppMessageSchema } from './outbound-contracts';
import {
  accountListMessage, BOT_NETFLIX_ID, BOT_SUPPORT_ID, botAccountId, hasMenuKeyword, menuMessage, readBotAction,
  retryMessage, shouldShowMenu,
} from './bot-menu';
import type { InboundMessage } from './webhook-payload';

const serviceId = '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b';
const now = new Date('2026-10-02T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

function reply(id: unknown, type: unknown = 'button_reply', messageType = 'interactive'): InboundMessage {
  return {
    waMessageId: 'wamid.1', phoneNumberId: '1', fromWaId: '50765331751', contactName: null, messageType,
    textBody: 'x', sentAt: now.toISOString(), mediaId: null, mediaMimeType: null, mediaFilename: null,
    contextWaMessageId: null, reactionEmoji: null, payload: { type, id, title: 'x' } as InboundMessage['payload'],
  };
}

describe('readBotAction', () => {
  it('maps the menu buttons and account rows', () => {
    expect(readBotAction(reply(BOT_NETFLIX_ID))).toEqual({ kind: 'netflix', serviceId: null });
    expect(readBotAction(reply(BOT_SUPPORT_ID))).toEqual({ kind: 'support' });
    expect(readBotAction(reply(botAccountId(serviceId), 'list_reply'))).toEqual({ kind: 'netflix', serviceId });
  });

  it.each([
    reply('BOT:ACC:not-a-uuid', 'list_reply'), reply('OTHER'), reply(BOT_NETFLIX_ID, 'template_button'),
    reply(7), reply(BOT_NETFLIX_ID, 'button_reply', 'text'),
    { ...reply(BOT_NETFLIX_ID), payload: [] }, { ...reply(BOT_NETFLIX_ID), payload: null },
  ])('ignores anything that is not our menu', (message) => {
    expect(readBotAction(message as InboundMessage)).toBeNull();
  });
});

describe('shouldShowMenu', () => {
  const base = { text: 'gracias', lastActivityAt: hoursAgo(1), operatorRepliedRecently: false, now };

  it('shows the menu for a keyword, a new conversation or after 12 hours idle', () => {
    expect(shouldShowMenu({ ...base, text: 'Hola buenas' })).toBe(true);
    expect(shouldShowMenu({ ...base, lastActivityAt: null })).toBe(true);
    expect(shouldShowMenu({ ...base, lastActivityAt: hoursAgo(12) })).toBe(true);
    expect(shouldShowMenu({ ...base, lastActivityAt: 'invalid' })).toBe(true);
  });

  it('stays quiet in an active conversation', () => {
    expect(shouldShowMenu(base)).toBe(false);
    expect(shouldShowMenu({ ...base, lastActivityAt: hoursAgo(11) })).toBe(false);
  });

  it('never interrupts a person who answered recently', () => {
    expect(shouldShowMenu({ ...base, text: 'hola', operatorRepliedRecently: true })).toBe(false);
    expect(shouldShowMenu({ ...base, lastActivityAt: null, operatorRepliedRecently: true })).toBe(false);
  });
});

describe('hasMenuKeyword', () => {
  it.each(['Código', 'NETFLIX', 'menú', 'ayuda por favor', 'Buenas tardes'])('matches %s', (text) => {
    expect(hasMenuKeyword(text)).toBe(true);
  });

  it.each([null, '', 'gracias', 'ya pague', 'holanda'])('does not match %s', (text) => {
    expect(hasMenuKeyword(text)).toBe(false);
  });
});

describe('outbound payloads', () => {
  const valid = (message: object) => sendWhatsAppMessageSchema.safeParse({
    idempotencyKey: '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b', to: '50765331751', message,
  }).success;

  it('fit the WhatsApp limits', () => {
    expect(valid(menuMessage)).toBe(true);
    expect(valid(retryMessage)).toBe(true);
    expect(valid(accountListMessage([{ serviceId, email: 'Netflix008@movietimepty.top', profile: 'Perfil 1' }]))).toBe(true);
  });

  it('lists at most ten accounts, with a short title and no empty description', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      serviceId, email: `${'x'.repeat(40)}${index}@movietimepty.top`, profile: '',
    }));
    const list = accountListMessage(many);
    expect(list.rows).toHaveLength(10);
    expect(list.rows[0].title).toHaveLength(24);
    expect('description' in list.rows[0]).toBe(false);
    expect(valid(list)).toBe(true);
  });
});
