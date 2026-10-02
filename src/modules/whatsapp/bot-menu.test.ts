import { describe, expect, it } from 'vitest';
import { sendWhatsAppMessageSchema } from './outbound-contracts';
import { accountListMessage, BOT_STORED_TEXT, readBotAction } from './bot-menu';
import type { InboundMessage } from './webhook-payload';

const serviceId = '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b';
const now = new Date('2026-10-02T12:00:00.000Z');
const texts = { body: 'Tienes varias cuentas de Netflix. ¿Para cuál es el código?', buttonLabel: 'Elegir cuenta' };

function reply(id: unknown, type: unknown = 'button_reply', messageType = 'interactive'): InboundMessage {
  return {
    waMessageId: 'wamid.1', phoneNumberId: '1', fromWaId: '50765331751', contactName: null, messageType,
    textBody: 'x', sentAt: now.toISOString(), mediaId: null, mediaMimeType: null, mediaFilename: null,
    contextWaMessageId: null, reactionEmoji: null, payload: { type, id, title: 'x' } as InboundMessage['payload'],
  };
}

describe('readBotAction', () => {
  it('reads the ids of the configurable flow', () => {
    expect(readBotAction(reply('BOT:menu:codigo'))).toEqual({ kind: 'option', nodeId: 'menu', optionId: 'codigo' });
    expect(readBotAction(reply('BOT:netflix:viaje', 'list_reply'))).toEqual({ kind: 'option', nodeId: 'netflix', optionId: 'viaje' });
  });

  it('maps the ids sent before the flow was configurable to compatibility aliases', () => {
    expect(readBotAction(reply('BOT:NETFLIX'))).toEqual({ kind: 'legacy', target: 'entry' });
    expect(readBotAction(reply('BOT:SUPPORT'))).toEqual({ kind: 'legacy', target: 'handoff' });
    expect(readBotAction(reply('BOT:NFX:LOGIN'))).toEqual({ kind: 'legacy', target: 'login' });
    expect(readBotAction(reply('BOT:NFX:TRAVEL'))).toEqual({ kind: 'legacy', target: 'travel' });
  });

  it('reads the account rows and keeps the code type', () => {
    expect(readBotAction(reply(`BOT:ACC:LOGIN:${serviceId}`, 'list_reply'))).toEqual({ kind: 'account', type: 'login', serviceId });
    expect(readBotAction(reply(`BOT:ACC:TRAVEL:${serviceId}`, 'list_reply'))).toEqual({ kind: 'account', type: 'travel', serviceId });
  });

  it.each([
    reply('BOT:ACC:LOGIN:not-a-uuid', 'list_reply'), reply('BOT:ACC:TRAVEL:', 'list_reply'),
    reply(`BOT:ACC:${serviceId}`, 'list_reply'), reply(`BOT:ACC:OTHER:${serviceId}`, 'list_reply'), reply('BOT:NFX:OTHER'),
    reply('OTHER'), reply('BOT:', 'button_reply'), reply('__proto__'), reply('BOT:menu'), reply('BOT:Menu:Codigo'),
    reply('BOT:NETFLIX', 'template_button'), reply(7), reply('BOT:NETFLIX', 'button_reply', 'text'),
    { ...reply('BOT:NETFLIX'), payload: [] }, { ...reply('BOT:NETFLIX'), payload: null },
  ])('ignores anything that is not our menu', (message) => {
    expect(readBotAction(message as InboundMessage)).toBeNull();
  });
});

describe('accountListMessage', () => {
  const valid = (message: object) => sendWhatsAppMessageSchema.safeParse({
    idempotencyKey: '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b', to: '50765331751', message,
  }).success;
  const account = { serviceId, email: 'Netflix008@movietimepty.top', profiles: ['Perfil 1', 'Perfil 2'] };

  it('fits the WhatsApp limits and uses the published wording', () => {
    const list = accountListMessage([account], 'login', texts);
    expect(valid(list)).toBe(true);
    expect(list).toMatchObject({ body: texts.body, buttonLabel: 'Elegir cuenta' });
  });

  it('keeps the code type in the account rows', () => {
    const [login] = accountListMessage([account], 'login', texts).rows;
    const [travel] = accountListMessage([account], 'travel', texts).rows;
    expect(login).toMatchObject({ id: `BOT:ACC:LOGIN:${serviceId}`, description: 'Perfil 1, Perfil 2' });
    expect(travel.id).toBe(`BOT:ACC:TRAVEL:${serviceId}`);
  });

  it('lists at most ten accounts, with a short title and no empty description', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      serviceId, email: `${'x'.repeat(40)}${index}@movietimepty.top`, profiles: [],
    }));
    const list = accountListMessage(many, 'login', texts);
    expect(list.rows).toHaveLength(10);
    expect(list.rows[0].title).toHaveLength(24);
    expect('description' in list.rows[0]).toBe(false);
    expect(valid(list)).toBe(true);
  });

  it('cuts a button label that is too long for WhatsApp', () => {
    expect(accountListMessage([account], 'login', { ...texts, buttonLabel: 'x'.repeat(40) }).buttonLabel).toHaveLength(20);
  });

  it('falls back to a generic title when the account has no name before the @', () => {
    expect(accountListMessage([{ serviceId, email: '@movietimepty.top', profiles: [] }], 'login', texts).rows[0].title).toBe('Cuenta');
  });
});

describe('BOT_STORED_TEXT', () => {
  it('never contains a code or a link', () => {
    expect(BOT_STORED_TEXT.code).not.toMatch(/\d/);
    expect(BOT_STORED_TEXT.link).not.toMatch(/https?:/);
  });
});
