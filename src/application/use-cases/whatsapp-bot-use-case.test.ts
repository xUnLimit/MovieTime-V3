import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/observability/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import type { BotService, BotStore } from '@/modules/messaging/bot-store';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import { handleBotMessage, type BotDeps } from './whatsapp-bot-use-case';

const now = new Date('2026-10-02T04:00:00.000Z');
const waId = '50765331751';
const serviceA: BotService = { serviceId: '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b', email: 'netflix008@movietimepty.top', profile: 'Perfil 1' };
const serviceB: BotService = { serviceId: '7a1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6c', email: 'netflix002@movietimepty.top', profile: '' };
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

const loginHtml = (email: string, code: string) =>
  `<td class="lrg-number"> ${code} </td><span data-testid="footer-disclaimer">a <a>[${email}]</a></span>`;
const verifyUrl = 'https://www.netflix.com/account/travel/verify?nftoken=A+b/c==&messageGuid=g';
const travelHtml = (email: string) =>
  `<a href="${verifyUrl.replace(/&/g, '&amp;')}">Obtener codigo</a><span data-testid="footer-disclaimer">a <a>[${email}]</a></span>`;

function inbound(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    waMessageId: 'wamid.IN', phoneNumberId: '1', fromWaId: waId, contactName: null, messageType: 'text',
    textBody: 'hola', sentAt: now.toISOString(), mediaId: null, mediaMimeType: null, mediaFilename: null,
    contextWaMessageId: null, reactionEmoji: null, payload: {}, ...overrides,
  };
}
const tap = (id: string, type = 'button_reply') => inbound({
  messageType: 'interactive', textBody: 'x', payload: { type, id, title: 'x' },
});

function setup(options: {
  services?: BotService[]; known?: boolean; mails?: { receivedAt: string; html: string }[]; taps?: number;
  lastActivityAt?: string | null; operator?: boolean; page?: string | null | Error; inbox?: 'none' | 'fails' | 'closeFails';
} = {}) {
  const store: BotStore = {
    customerServices: vi.fn().mockResolvedValue({ known: options.known ?? true, services: options.services ?? [serviceA] }),
    lastActivityAt: vi.fn().mockResolvedValue(options.lastActivityAt ?? null),
    operatorRepliedSince: vi.fn().mockResolvedValue(options.operator ?? false),
    menuTapsSince: vi.fn().mockResolvedValue(options.taps ?? 1),
  };
  const close = vi.fn().mockImplementation(() => options.inbox === 'closeFails' ? Promise.reject(new Error('x')) : Promise.resolve());
  const recent = vi.fn().mockResolvedValue(options.mails ?? []);
  const send = vi.fn().mockResolvedValue({ id: 'o1', sendStatus: 'accepted', waMessageId: 'wamid.OUT', errorTitle: null, replayed: false });
  const fetchTravelPage = vi.fn().mockImplementation(async () => {
    if (options.page instanceof Error) throw options.page;
    return options.page === undefined ? null : options.page;
  });
  const deps: BotDeps = {
    store, send, fetchTravelPage, now: () => now,
    openInbox: vi.fn().mockImplementation(async () => {
      if (options.inbox === 'none') return null;
      if (options.inbox === 'fails') throw new Error('imap down');
      return { recent, close };
    }),
  };
  return { deps, store, send, recent, close, fetchTravelPage };
}
const sentPayload = (send: ReturnType<typeof setup>['send']) => send.mock.calls[0][0].payload;

describe('handleBotMessage menu', () => {
  it('offers the menu to a registered customer who writes after a long silence', async () => {
    const { deps, send } = setup({ lastActivityAt: minutesAgo(13 * 60) });
    await expect(handleBotMessage(inbound({ textBody: 'gracias' }), deps)).resolves.toBe('menu');
    expect(sentPayload(send)).toMatchObject({ kind: 'buttons' });
    expect(send.mock.calls[0][0]).toMatchObject({ toWaId: waId, sentBy: null });
  });

  it('answers a keyword even in an active conversation', async () => {
    const { deps } = setup({ lastActivityAt: minutesAgo(5) });
    await expect(handleBotMessage(inbound({ textBody: 'Código de Netflix' }), deps)).resolves.toBe('menu');
  });

  it('stays quiet in an active conversation, after a person answered, or for non-text messages', async () => {
    const active = setup({ lastActivityAt: minutesAgo(5) });
    await expect(handleBotMessage(inbound({ textBody: 'gracias' }), active.deps)).resolves.toBe('ignored');
    const operator = setup({ operator: true });
    await expect(handleBotMessage(inbound(), operator.deps)).resolves.toBe('ignored');
    const media = setup();
    await expect(handleBotMessage(inbound({ messageType: 'image', textBody: null }), media.deps)).resolves.toBe('ignored');
    expect(media.store.customerServices).not.toHaveBeenCalled();
    for (const { send } of [active, operator, media]) expect(send).not.toHaveBeenCalled();
  });

  it('never answers numbers that are not a registered customer, or customers without Netflix', async () => {
    const stranger = setup({ known: false, services: [] });
    await expect(handleBotMessage(inbound(), stranger.deps)).resolves.toBe('ignored');
    const other = setup({ services: [] });
    await expect(handleBotMessage(inbound(), other.deps)).resolves.toBe('ignored');
    await expect(handleBotMessage(tap('BOT:NETFLIX'), other.deps)).resolves.toBe('none');
    expect(stranger.send).not.toHaveBeenCalled();
    expect(other.send).toHaveBeenCalledTimes(1);
  });
});

describe('handleBotMessage actions', () => {
  it('hands the conversation to a person on request', async () => {
    const { deps, send } = setup();
    await expect(handleBotMessage(tap('BOT:SUPPORT'), deps)).resolves.toBe('support');
    expect(sentPayload(send)).toMatchObject({ kind: 'text' });
  });

  it('sends the login code and hides it in the stored chat', async () => {
    const { deps, send, recent } = setup({ mails: [{ receivedAt: minutesAgo(2), html: loginHtml('Netflix008@movietimepty.top', '3916') }] });
    await expect(handleBotMessage(tap('BOT:NETFLIX'), deps)).resolves.toBe('code');
    expect(recent).toHaveBeenCalledWith(new Date(now.getTime() - 16 * 60_000));
    const sent = send.mock.calls[0][0];
    expect(sent.payload).toMatchObject({ kind: 'text', replyTo: 'wamid.IN' });
    expect(sent.payload.text).toContain('3916');
    expect(sent.storedTextBody).not.toContain('3916');
    expect(sent.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reads the code behind the travel link', async () => {
    const { deps, send, fetchTravelPage } = setup({
      mails: [{ receivedAt: minutesAgo(1), html: travelHtml('netflix008@movietimepty.top') }],
      page: '<div class="challenge-code">4003</div>',
    });
    await expect(handleBotMessage(tap('BOT:NETFLIX'), deps)).resolves.toBe('code');
    expect(fetchTravelPage).toHaveBeenCalledWith(verifyUrl);
    expect(sentPayload(send)).toMatchObject({ text: expect.stringContaining('4003') });
  });

  it.each([
    ['the page cannot be read', null], ['the page has no code', '<html>login</html>'], ['the request fails', new Error('net')],
  ])('falls back to the link when %s', async (_label, page) => {
    const { deps, send } = setup({ mails: [{ receivedAt: minutesAgo(1), html: travelHtml('netflix008@movietimepty.top') }], page });
    await expect(handleBotMessage(tap('BOT:NETFLIX'), deps)).resolves.toBe('link');
    expect(sentPayload(send)).toMatchObject({ text: expect.stringContaining(verifyUrl) });
    expect(send.mock.calls[0][0].storedTextBody).not.toContain('nftoken');
  });

  it('asks the customer to try again when no recent mail arrived', async () => {
    const { deps, send } = setup({ mails: [{ receivedAt: minutesAgo(30), html: loginHtml('netflix008@movietimepty.top', '1111') }] });
    await expect(handleBotMessage(tap('BOT:NETFLIX'), deps)).resolves.toBe('retry');
    expect(sentPayload(send)).toMatchObject({ kind: 'buttons' });
  });

  it('ignores mail that belongs to someone else', async () => {
    const { deps } = setup({ mails: [{ receivedAt: minutesAgo(1), html: loginHtml('stranger@movietimepty.top', '1111') }] });
    await expect(handleBotMessage(tap('BOT:NETFLIX'), deps)).resolves.toBe('retry');
  });

  it('picks the only account that just received a code', async () => {
    const { deps, send } = setup({
      services: [serviceA, serviceB], mails: [
        { receivedAt: minutesAgo(1), html: loginHtml('netflix002@movietimepty.top', '2222') },
        { receivedAt: minutesAgo(20), html: loginHtml('netflix008@movietimepty.top', '1111') },
        { receivedAt: minutesAgo(3), html: '<p>sin codigo</p>' },
      ],
    });
    await expect(handleBotMessage(tap('BOT:NETFLIX'), deps)).resolves.toBe('code');
    expect(sentPayload(send)).toMatchObject({ text: expect.stringContaining('2222') });
  });

  it('lists the accounts when several received a code, then honours the chosen one', async () => {
    const mails = [
      { receivedAt: minutesAgo(1), html: loginHtml('netflix002@movietimepty.top', '2222') },
      { receivedAt: minutesAgo(2), html: loginHtml('netflix008@movietimepty.top', '1111') },
    ];
    const first = setup({ services: [serviceA, serviceB], mails });
    await expect(handleBotMessage(tap('BOT:NETFLIX'), first.deps)).resolves.toBe('list');
    expect(sentPayload(first.send)).toMatchObject({ kind: 'list', rows: [expect.anything(), expect.anything()] });
    const chosen = setup({ services: [serviceA, serviceB], mails });
    await expect(handleBotMessage(tap(`BOT:ACC:${serviceA.serviceId}`, 'list_reply'), chosen.deps)).resolves.toBe('code');
    expect(sentPayload(chosen.send)).toMatchObject({ text: expect.stringContaining('1111') });
  });

  it('refuses an account row that is not the customer\'s', async () => {
    const { deps, recent } = setup({ services: [serviceA] });
    await expect(handleBotMessage(tap('BOT:ACC:9f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6d', 'list_reply'), deps)).resolves.toBe('none');
    expect(recent).not.toHaveBeenCalled();
  });

  it('limits repeated requests before touching the mailbox', async () => {
    const { deps, recent, send } = setup({ taps: 7 });
    await expect(handleBotMessage(tap('BOT:NETFLIX'), deps)).resolves.toBe('limited');
    expect(recent).not.toHaveBeenCalled();
    expect(sentPayload(send)).toMatchObject({ kind: 'text' });
  });

  it.each(['none', 'fails'] as const)('tells the customer help is coming when the mailbox is unavailable (%s)', async (inbox) => {
    const { deps, send } = setup({ inbox });
    await expect(handleBotMessage(tap('BOT:NETFLIX'), deps)).resolves.toBe('unavailable');
    expect(sentPayload(send)).toMatchObject({ kind: 'text' });
  });

  it('still answers when the mailbox does not close cleanly', async () => {
    const { deps } = setup({ inbox: 'closeFails', mails: [{ receivedAt: minutesAgo(1), html: loginHtml('netflix008@movietimepty.top', '3916') }] });
    await expect(handleBotMessage(tap('BOT:NETFLIX'), deps)).resolves.toBe('code');
  });

  it('closes the mailbox even when reading it fails', async () => {
    const { deps, recent, close } = setup();
    recent.mockRejectedValue(new Error('read failed'));
    await expect(handleBotMessage(tap('BOT:NETFLIX'), deps)).resolves.toBe('unavailable');
    expect(close).toHaveBeenCalledOnce();
  });
});
