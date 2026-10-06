import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/observability/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { addConditionNode, addOption, addPurchaseFlow, connectOption, defaultDefinition, setEntryNode, updateNode } from '@/modules/bot-config';
import type { BotService, BotStore } from '@/modules/messaging/bot-store';
import type { NetflixClaimStore } from '@/modules/messaging/netflix-claim-store';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { BotActionKey, BotDefinition, BotEventType } from '@/types/bot';
import type { BotDeps, BotHandBack } from './bot-reply';
import { handleBotMessage } from './whatsapp-bot-use-case';

const now = new Date('2026-10-02T04:00:00.000Z');
const waId = '50765331751';
const serviceA: BotService = { serviceId: '3f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b', email: 'netflix008@movietimepty.top', profiles: ['Ana María'] };
const serviceB: BotService = { serviceId: '7a1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6c', email: 'netflix002@movietimepty.top', profiles: ['Beto'] };
const serviceNoProfile: BotService = { ...serviceB, profiles: [] };
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const keyOf = (value: string) => createHash('sha256').update(value).digest('hex');

const loginHtml = (email: string, code: string) =>
  `<td class="lrg-number"> ${code} </td><span data-testid="footer-disclaimer">a <a>[${email}]</a></span>`;
const verifyUrl = 'https://www.netflix.com/account/travel/verify?nftoken=A+b/c==&messageGuid=g';
const travelHtml = (email: string, profile: string | null = 'Ana María') =>
  `${profile === null ? '' : `<p>Hola, <span class="break-word">${profile}</span>:</p>`}`
  + `<a href="${verifyUrl.replace(/&/g, '&amp;')}">Obtener codigo</a><span data-testid="footer-disclaimer">a <a>[${email}]</a></span>`;
type RawMail = { receivedAt: string; messageId: string | null; html: string };
const loginMail = (email: string, code: string, minutes: number, messageId: string | null = `<${code}@ejemplo.test>`): RawMail =>
  ({ receivedAt: minutesAgo(minutes), messageId, html: loginHtml(email, code) });
const travelMail = (email: string, profile: string | null, minutes: number, messageId: string | null = `<t-${email}-${minutes}@ejemplo.test>`): RawMail =>
  ({ receivedAt: minutesAgo(minutes), messageId, html: travelHtml(email, profile) });

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
const MESSAGES = defaultDefinition().messages;
const LOGIN = 'BOT:netflix:login';
const TRAVEL = 'BOT:netflix:viaje';

function setup(options: {
  services?: BotService[]; known?: boolean; hasServices?: boolean; mails?: RawMail[]; taps?: number; owners?: Record<string, string>;
  delivered?: boolean; claimResult?: 'claimed' | 'mine' | 'taken'; lastActivityAt?: string | null; operator?: boolean; page?: string | null | Error;
  inbox?: 'none' | 'fails' | 'closeFails'; sendStatus?: string; sendThrows?: boolean; releaseThrows?: boolean; definition?: BotDefinition; eventsThrow?: boolean;
} = {}) {
  const store: BotStore = {
    customerServices: vi.fn().mockResolvedValue({
      known: options.known ?? true, clienteId: 'c1', services: options.services ?? [serviceA],
      hasServices: options.hasServices ?? (options.services ?? [serviceA]).length > 0,
    }),
    lastActivityAt: vi.fn().mockResolvedValue(options.lastActivityAt ?? null),
    operatorRepliedSince: vi.fn().mockResolvedValue(options.operator ?? false),
    menuTapsSince: vi.fn().mockResolvedValue(options.taps ?? 1),
  };
  const owners = new Map(Object.entries(options.owners ?? {}));
  const claims: NetflixClaimStore = {
    delivered: vi.fn().mockResolvedValue(options.delivered ?? true),
    owners: vi.fn().mockImplementation(async () => owners),
    claim: vi.fn().mockResolvedValue(options.claimResult ?? 'claimed'),
    release: vi.fn().mockImplementation(async () => {
      if (options.releaseThrows) throw new Error('db down');
      return true;
    }),
  };
  const close = vi.fn().mockImplementation(() => options.inbox === 'closeFails' ? Promise.reject(new Error('x')) : Promise.resolve());
  const recent = vi.fn().mockResolvedValue(options.mails ?? []);
  const send = vi.fn().mockImplementation(async () => {
    if (options.sendThrows) throw new Error('whatsapp down');
    return { id: 'o1', sendStatus: options.sendStatus ?? 'accepted', waMessageId: 'wamid.OUT', errorTitle: null, replayed: false };
  });
  const fetchTravelPage = vi.fn().mockImplementation(async () => {
    if (options.page instanceof Error) throw options.page;
    return options.page === undefined ? null : options.page;
  });
  const record = vi.fn().mockImplementation(async () => {
    if (options.eventsThrow) throw new Error('events down');
  });
  const deps: BotDeps = {
    store, claims, send, fetchTravelPage, now: () => now, events: { record }, definition: options.definition ?? defaultDefinition(),
    openInbox: vi.fn().mockImplementation(async () => {
      if (options.inbox === 'none') return null;
      if (options.inbox === 'fails') throw new Error('imap down');
      return { recent, close };
    }),
  };
  return { deps, store, claims, send, recent, close, fetchTravelPage, record };
}
const sentPayload = (send: ReturnType<typeof setup>['send']) => send.mock.calls[0][0].payload;
const sentText = (send: ReturnType<typeof setup>['send']) => String(sentPayload(send).text);
const sentButtonId = (send: ReturnType<typeof setup>['send']) => sentPayload(send).buttons[0].id;

describe('Netflix delivery receipts', () => {
  it.each([false, true])('retries a failed no-code notification, including a claim race: %s', race => {
    const { deps } = setup({ sendStatus: 'failed', ...(race ? { mails: [loginMail(serviceA.email, '1234', 1)], claimResult: 'taken' as const } : {}) });
    return expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('send_failed');
  });
  it('does not replay the no-mail reply as a delivered code when the same inbound is retried', async () => {
    const { deps, recent, send, claims } = setup();
    const accepted = new Map<string, Parameters<BotDeps['send']>[0]>();
    send.mockImplementation(async (input: Parameters<BotDeps['send']>[0]) => {
      const replayed = accepted.has(input.idempotencyKey);
      if (!replayed) accepted.set(input.idempotencyKey, input);
      return { id: 'o1', sendStatus: 'accepted', waMessageId: 'wamid.OUT', errorTitle: null, replayed };
    });
    vi.mocked(claims.delivered).mockImplementation(async key => accepted.has(key));
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('not_found');
    recent.mockResolvedValue([loginMail(serviceA.email, '1234', 1)]);
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('code');
    expect(accepted.size).toBe(2);
    expect([...accepted.values()][1].payload).toMatchObject({ kind: 'text', text: expect.stringContaining('1234') });
    expect([...accepted.values()][1].storedTextBody).not.toContain('1234');
    vi.mocked(claims.owners).mockResolvedValue(new Map([[keyOf('<1234@ejemplo.test>'), waId]]));
    vi.mocked(claims.claim).mockResolvedValue('mine');
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('already_sent');
  });

  it('recovers an incorrectly retained claim only for its owner and records a real delivery', async () => {
    const { deps, send, claims } = setup({ mails: [loginMail(serviceA.email, '1234', 1)],
      owners: { [keyOf('<1234@ejemplo.test>')]: waId }, claimResult: 'mine', delivered: false });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('code');
    expect(sentText(send)).toContain('1234');
    expect(claims.release).not.toHaveBeenCalled();
  });

  it.each([{ sendStatus: 'failed' }, { sendThrows: true }])('keeps ownership if recovering a claim fails: %o', async options => {
    const { deps, claims } = setup({ ...options, mails: [loginMail(serviceA.email, '1234', 1)],
      owners: { [keyOf('<1234@ejemplo.test>')]: waId }, claimResult: 'mine', delivered: false });
    if (options.sendThrows) await expect(handleBotMessage(tap(LOGIN), deps)).rejects.toThrow('whatsapp down');
    else await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('send_failed');
    expect(claims.release).not.toHaveBeenCalled();
  });

  it('does not recover another customer’s claim even when it lacks a delivery receipt', async () => {
    const { deps, send, claims } = setup({ mails: [loginMail(serviceA.email, '1234', 1)],
      owners: { [keyOf('<1234@ejemplo.test>')]: 'another-customer' }, delivered: false });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('not_found');
    expect(claims.claim).not.toHaveBeenCalled();
    expect(claims.delivered).not.toHaveBeenCalled();
    expect(sentPayload(send)).toMatchObject({ kind: 'buttons' });
  });
});

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

});

describe('handleBotMessage actions', () => {
  it('authorizes a sale-bound access button again and never trusts the provided sale id', async () => {
    const saleId = '123e4567-e89b-42d3-a456-426614174000';
    const own = setup({ mails: [loginMail(serviceA.email, '3916', 1)] });
    own.deps.resolveOwnedSale = vi.fn().mockResolvedValue(serviceA.serviceId);
    await expect(handleBotMessage(tap(`ACCESS:LOGIN:${saleId}`), own.deps)).resolves.toBe('code');
    expect(own.deps.resolveOwnedSale).toHaveBeenCalledWith(waId, saleId);
    for (const resolved of [null,serviceB.serviceId]) {
      const rejected=setup(); rejected.deps.resolveOwnedSale=vi.fn().mockResolvedValue(resolved);
      await expect(handleBotMessage(tap(`ACCESS:LOGIN:${saleId}`),rejected.deps)).resolves.toBe('ignored');
      expect(rejected.recent).not.toHaveBeenCalled(); expect(rejected.send).not.toHaveBeenCalled();
    }
    const absent=setup(); await expect(handleBotMessage(tap(`ACCESS:LOGIN:${saleId}`),absent.deps)).resolves.toBe('ignored');
    expect(absent.recent).not.toHaveBeenCalled();
    const invalid=setup(); await expect(handleBotMessage(tap('ACCESS:LOGIN:invalid'),invalid.deps)).resolves.toBe('ignored');
    expect(invalid.recent).not.toHaveBeenCalled();
  });
  it('hands the conversation to a person on request', async () => {
    const { deps, send } = setup();
    await expect(handleBotMessage(tap('BOT:menu:soporte'), deps)).resolves.toBe('handoff');
    expect(sentPayload(send)).toMatchObject({ kind: 'text' });
  });

  it('asks which code is needed before touching the mailbox', async () => {
    const { deps, send, recent, claims } = setup();
    await expect(handleBotMessage(tap('BOT:menu:codigo'), deps)).resolves.toBe('node');
    expect(sentPayload(send)).toMatchObject({ kind: 'buttons', buttons: [{ id: LOGIN }, { id: TRAVEL }] });
    expect(recent).not.toHaveBeenCalled();
    expect(claims.owners).not.toHaveBeenCalled();
  });

  it('limits repeated requests before touching the mailbox', async () => {
    const { deps, recent, send } = setup({ taps: 7 });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('limited');
    expect(recent).not.toHaveBeenCalled();
    expect(sentPayload(send)).toMatchObject({ kind: 'text' });
  });

  it('refuses an account row that is not the customer\'s', async () => {
    const { deps, recent } = setup({ services: [serviceA] });
    await expect(handleBotMessage(tap('BOT:ACC:LOGIN:9f1c2a4e-5b6d-4e8f-9a0b-1c2d3e4f5a6d', 'list_reply'), deps)).resolves.toBe('none');
    expect(recent).not.toHaveBeenCalled();
  });

  it.each(['none', 'fails'] as const)('tells the customer help is coming when the mailbox is unavailable (%s)', async (inbox) => {
    const { deps, send } = setup({ inbox });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('unavailable');
    expect(sentPayload(send)).toMatchObject({ kind: 'text' });
  });

  it('closes the mailbox even when reading it fails', async () => {
    const { deps, recent, close } = setup();
    recent.mockRejectedValue(new Error('read failed'));
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('unavailable');
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('sign-in code', () => {
  it('claims the mail, sends the code and hides it in the stored chat', async () => {
    const { deps, send, recent, claims } = setup({ mails: [loginMail('Netflix008@movietimepty.top', '3916', 2)] });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('code');
    expect(recent).toHaveBeenCalledWith(new Date(now.getTime() - 6 * 60_000));
    expect(claims.claim).toHaveBeenCalledWith(keyOf('<3916@ejemplo.test>'), waId);
    expect(claims.release).not.toHaveBeenCalled();
    const sent = send.mock.calls[0][0];
    expect(sent.payload).toMatchObject({ kind: 'text', replyTo: 'wamid.IN' });
    expect(sent.payload.text).toContain('3916');
    expect(sent.storedTextBody).not.toContain('3916');
    expect(sent.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not need a profile and ignores travel mails', async () => {
    const { deps, send } = setup({
      services: [serviceNoProfile],
      mails: [travelMail('netflix002@movietimepty.top', 'Beto', 1), loginMail('netflix002@movietimepty.top', '2222', 1)],
    });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('code');
    expect(sentText(send)).toContain('2222');
  });

  it('builds the mail key from account and time when the message has no id', async () => {
    const { deps, claims } = setup({ mails: [loginMail('netflix008@movietimepty.top', '1111', 1, null)] });
    await handleBotMessage(tap(LOGIN), deps);
    expect(claims.claim).toHaveBeenCalledWith(keyOf(`netflix008@movietimepty.top|${minutesAgo(1)}`), waId);
  });

  it('asks the customer to request the code again when no recent mail arrived', async () => {
    const { deps, send, claims } = setup({ mails: [loginMail('netflix008@movietimepty.top', '1111', 6)] });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('not_found');
    expect(sentPayload(send)).toMatchObject({ kind: 'buttons' });
    expect(sentButtonId(send)).toBe(LOGIN);
    expect(claims.claim).not.toHaveBeenCalled();
  });

  it('ignores mail that belongs to someone else', async () => {
    const { deps } = setup({ mails: [loginMail('stranger@movietimepty.top', '1111', 1)] });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('not_found');
  });

  it('never gives a customer the code another customer already received', async () => {
    const { deps, send, claims } = setup({
      mails: [loginMail('netflix008@movietimepty.top', '1111', 1)], owners: { [keyOf('<1111@ejemplo.test>')]: '50760000000' },
    });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('not_found');
    expect(claims.claim).not.toHaveBeenCalled();
    expect(JSON.stringify(send.mock.calls)).not.toContain('1111');
    expect(sentButtonId(send)).toBe(LOGIN);
  });

  it('says it was already sent, without resending, when the customer received the only mail', async () => {
    const { deps, send, claims } = setup({
      mails: [loginMail('netflix008@movietimepty.top', '1111', 1)], owners: { [keyOf('<1111@ejemplo.test>')]: waId },
    });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('already_sent');
    expect(claims.claim).not.toHaveBeenCalled();
    expect(sentText(send)).toBe(MESSAGES.already_sent);
    expect(sentText(send)).not.toContain('1111');
  });

  it('skips the mails taken by others and claims the one left', async () => {
    const { deps, send, claims } = setup({
      mails: [loginMail('netflix008@movietimepty.top', '1111', 1), loginMail('netflix008@movietimepty.top', '2222', 3)],
      owners: { [keyOf('<1111@ejemplo.test>')]: '50760000000' },
    });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('code');
    expect(claims.claim).toHaveBeenCalledWith(keyOf('<2222@ejemplo.test>'), waId);
    expect(sentText(send)).toContain('2222');
  });

  it('takes the newest of several free mails of the same account', async () => {
    const { deps, claims } = setup({
      mails: [loginMail('netflix008@movietimepty.top', '2222', 3), loginMail('netflix008@movietimepty.top', '1111', 1)],
    });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('code');
    expect(claims.claim).toHaveBeenCalledWith(keyOf('<1111@ejemplo.test>'), waId);
  });

  it('claims a new mail even when the customer already received an older one', async () => {
    const { deps, claims } = setup({
      mails: [loginMail('netflix008@movietimepty.top', '1111', 1), loginMail('netflix008@movietimepty.top', '2222', 3)],
      owners: { [keyOf('<2222@ejemplo.test>')]: waId },
    });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('code');
    expect(claims.claim).toHaveBeenCalledWith(keyOf('<1111@ejemplo.test>'), waId);
  });

  it('lists the accounts when several have a free mail, keeping the type, then honours the chosen one', async () => {
    const mails = [loginMail('netflix002@movietimepty.top', '2222', 1), loginMail('netflix008@movietimepty.top', '1111', 2)];
    const first = setup({ services: [serviceA, serviceB], mails });
    await expect(handleBotMessage(tap(LOGIN), first.deps)).resolves.toBe('list');
    expect(sentPayload(first.send)).toMatchObject({
      kind: 'list', rows: [{ id: `BOT:ACC:LOGIN:${serviceA.serviceId}` }, { id: `BOT:ACC:LOGIN:${serviceB.serviceId}` }],
    });
    expect(first.claims.claim).not.toHaveBeenCalled();
    const chosen = setup({ services: [serviceA, serviceB], mails });
    await expect(handleBotMessage(tap(`BOT:ACC:LOGIN:${serviceA.serviceId}`, 'list_reply'), chosen.deps)).resolves.toBe('code');
    expect(sentText(chosen.send)).toContain('1111');
    expect(chosen.claims.claim).toHaveBeenCalledWith(keyOf('<1111@ejemplo.test>'), waId);
  });

  it('picks the only account with a free mail when the others were taken', async () => {
    const { deps, send } = setup({
      services: [serviceA, serviceB],
      mails: [loginMail('netflix002@movietimepty.top', '2222', 1), loginMail('netflix008@movietimepty.top', '1111', 2)],
      owners: { [keyOf('<2222@ejemplo.test>')]: '50760000000' },
    });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('code');
    expect(sentText(send)).toContain('1111');
  });

  it('tells the customer it was already sent when the claim says the mail is his', async () => {
    const { deps, send } = setup({ mails: [loginMail('netflix008@movietimepty.top', '1111', 1)], claimResult: 'mine' });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('already_sent');
    expect(sentText(send)).toContain('Ya te envié');
    expect(sentText(send)).not.toContain('1111');
  });

  it('asks to try again when someone else wins the race for the mail', async () => {
    const { deps, send, claims } = setup({ mails: [loginMail('netflix008@movietimepty.top', '1111', 1)], claimResult: 'taken' });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('not_found');
    expect(sentButtonId(send)).toBe(LOGIN);
    expect(JSON.stringify(send.mock.calls)).not.toContain('1111');
    expect(claims.release).not.toHaveBeenCalled();
  });

  it.each(['failed', 'pending'])('releases the claim when WhatsApp answers %s', async (sendStatus) => {
    const { deps, claims } = setup({ mails: [loginMail('netflix008@movietimepty.top', '1111', 1)], sendStatus });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('send_failed');
    expect(claims.release).toHaveBeenCalledWith(keyOf('<1111@ejemplo.test>'), waId);
  });

  it('releases the claim and reports the error when sending throws', async () => {
    const { deps, claims } = setup({ mails: [loginMail('netflix008@movietimepty.top', '1111', 1)], sendThrows: true });
    await expect(handleBotMessage(tap(LOGIN), deps)).rejects.toThrow('whatsapp down');
    expect(claims.release).toHaveBeenCalledWith(keyOf('<1111@ejemplo.test>'), waId);
  });

  it('keeps reporting the failure when the claim cannot be released', async () => {
    const { deps, claims } = setup({ mails: [loginMail('netflix008@movietimepty.top', '1111', 1)], sendThrows: true, releaseThrows: true });
    await expect(handleBotMessage(tap(LOGIN), deps)).rejects.toThrow('whatsapp down');
    expect(claims.release).toHaveBeenCalledOnce();
  });

  it('still answers when the mailbox does not close cleanly', async () => {
    const { deps } = setup({ inbox: 'closeFails', mails: [loginMail('netflix008@movietimepty.top', '3916', 1)] });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('code');
  });
});

describe('travel code', () => {
  const page = '<div class="challenge-code">4003</div>';

  it('reads the code behind the link of the matching profile, ignoring case and accents', async () => {
    const { deps, send, fetchTravelPage, recent, claims } = setup({
      mails: [travelMail('netflix008@movietimepty.top', 'ANA  maria', 1)], page,
    });
    await expect(handleBotMessage(tap(TRAVEL), deps)).resolves.toBe('code');
    expect(recent).toHaveBeenCalledWith(new Date(now.getTime() - 16 * 60_000));
    expect(fetchTravelPage).toHaveBeenCalledWith(verifyUrl);
    expect(claims.claim).toHaveBeenCalledOnce();
    expect(sentText(send)).toContain('4003');
    expect(send.mock.calls[0][0].storedTextBody).not.toContain('4003');
  });

  it.each([
    ['the page cannot be read', null], ['the page has no code', '<html>login</html>'], ['the request fails', new Error('net')],
  ])('falls back to the link, keeping the claim, when %s', async (_label, unreadable) => {
    const { deps, send, claims } = setup({ mails: [travelMail('netflix008@movietimepty.top', 'Ana María', 1)], page: unreadable });
    await expect(handleBotMessage(tap(TRAVEL), deps)).resolves.toBe('link');
    expect(sentText(send)).toContain(verifyUrl);
    expect(send.mock.calls[0][0].storedTextBody).not.toContain('nftoken');
    expect(claims.release).not.toHaveBeenCalled();
  });

  it('releases the claim when the link cannot be sent', async () => {
    const { deps, claims } = setup({ mails: [travelMail('netflix008@movietimepty.top', 'Ana María', 1)], sendStatus: 'failed' });
    await expect(handleBotMessage(tap(TRAVEL), deps)).resolves.toBe('send_failed');
    expect(claims.release).toHaveBeenCalledOnce();
  });

  it('never delivers a request made by another profile and names the customer profile', async () => {
    const { deps, send, fetchTravelPage, claims } = setup({
      mails: [travelMail('netflix008@movietimepty.top', 'Pedro', 1), travelMail('netflix008@movietimepty.top', null, 1)], page,
    });
    await expect(handleBotMessage(tap(TRAVEL), deps)).resolves.toBe('not_found');
    expect(fetchTravelPage).not.toHaveBeenCalled();
    expect(claims.claim).not.toHaveBeenCalled();
    expect(sentButtonId(send)).toBe(TRAVEL);
    expect(sentPayload(send).body).toContain('*Ana María*');
  });

  it('blocks the request when no sale has a noted profile, without reading the mailbox', async () => {
    const { deps, send, recent } = setup({ services: [serviceNoProfile], mails: [travelMail('netflix002@movietimepty.top', 'Beto', 1)] });
    await expect(handleBotMessage(tap(TRAVEL), deps)).resolves.toBe('no_profile');
    expect(recent).not.toHaveBeenCalled();
    expect(sentText(send)).toBe(MESSAGES.profile_missing);
  });

  it('only considers the accounts that have a noted profile', async () => {
    const { deps, send } = setup({
      services: [serviceA, serviceNoProfile],
      mails: [travelMail('netflix002@movietimepty.top', 'Beto', 1), travelMail('netflix008@movietimepty.top', 'Ana María', 2)], page,
    });
    await expect(handleBotMessage(tap(TRAVEL), deps)).resolves.toBe('code');
    expect(sentText(send)).toContain('4003');
  });

  it('lists the accounts when several have a request for the customer profile', async () => {
    const { deps, send, claims } = setup({
      services: [serviceA, serviceB],
      mails: [travelMail('netflix002@movietimepty.top', 'Beto', 1), travelMail('netflix008@movietimepty.top', 'Ana María', 2)],
    });
    await expect(handleBotMessage(tap(TRAVEL), deps)).resolves.toBe('list');
    expect(sentPayload(send)).toMatchObject({ rows: [{ id: `BOT:ACC:TRAVEL:${serviceA.serviceId}` }, { id: `BOT:ACC:TRAVEL:${serviceB.serviceId}` }] });
    expect(claims.claim).not.toHaveBeenCalled();
  });

  it('delivers a request only once and uses the longer window of 15 minutes', async () => {
    const old = travelMail('netflix008@movietimepty.top', 'Ana María', 14, '<old@ejemplo.test>');
    const expired = travelMail('netflix008@movietimepty.top', 'Ana María', 16, '<expired@ejemplo.test>');
    const taken = setup({ mails: [old], owners: { [keyOf('<old@ejemplo.test>')]: '50760000000' } });
    await expect(handleBotMessage(tap(TRAVEL), taken.deps)).resolves.toBe('not_found');
    const free = setup({ mails: [old, expired], page });
    await expect(handleBotMessage(tap(TRAVEL), free.deps)).resolves.toBe('code');
    expect(free.claims.claim).toHaveBeenCalledWith(keyOf('<old@ejemplo.test>'), waId);
  });
});

const withDefinition = (change: (definition: BotDefinition) => void): BotDefinition => {
  const definition = defaultDefinition();
  change(definition);
  return definition;
};
const eventTypes = (record: ReturnType<typeof setup>['record']) => record.mock.calls.map(([event]) => event.type as BotEventType);

describe('compatibility with buttons sent before the flow was configurable', () => {
  it.each([
    ['BOT:NETFLIX', 'node'], ['BOT:SUPPORT', 'handoff'], ['BOT:NFX:LOGIN', 'unavailable'], ['BOT:NFX:TRAVEL', 'unavailable'],
  ])('answers the old id %s as an alias', async (id, expected) => {
    const { deps } = setup({ inbox: 'none' });
    await expect(handleBotMessage(tap(id), deps)).resolves.toBe(expected);
  });

  it('resends the entry node for the old Netflix button and the matching code for the old code buttons', async () => {
    const entry = setup();
    await handleBotMessage(tap('BOT:NETFLIX'), entry.deps);
    expect(sentPayload(entry.send)).toMatchObject({ kind: 'buttons', body: 'Hola, soy el asistente de MovieTime PTY. ¿Qué necesitas?' });
    const login = setup({ mails: [loginMail('netflix008@movietimepty.top', '3916', 1)] });
    await expect(handleBotMessage(tap('BOT:NFX:LOGIN'), login.deps)).resolves.toBe('code');
    const travel = setup({ mails: [travelMail('netflix008@movietimepty.top', 'Ana María', 1)], page: '<div class="challenge-code">4003</div>' });
    await expect(handleBotMessage(tap('BOT:NFX:TRAVEL'), travel.deps)).resolves.toBe('code');
  });

  it('does not depend on the published flow still having the old nodes', async () => {
    const { deps } = setup({ definition: withDefinition((d) => { d.nodes = d.nodes.filter((node) => node.id === 'menu'); d.nodes[0].options = []; }) });
    await expect(handleBotMessage(tap('BOT:SUPPORT'), deps)).resolves.toBe('handoff');
  });

  it('ignores an old entry alias when the entry node is gone', async () => {
    const { deps, send } = setup({ definition: withDefinition((d) => { d.entryNodeId = 'inexistente'; }) });
    await expect(handleBotMessage(tap('BOT:NETFLIX'), deps)).resolves.toBe('ignored');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('options of the published flow', () => {
  it('sends the node an option leads to and records the choice', async () => {
    const { deps, send, record } = setup();
    await expect(handleBotMessage(tap('BOT:menu:codigo'), deps)).resolves.toBe('node');
    expect(sentPayload(send)).toMatchObject({ kind: 'buttons', buttons: [{ id: LOGIN, title: 'Iniciar sesión' }, { id: TRAVEL, title: 'Estoy de viaje' }] });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      waId, clienteId: 'c1', type: 'option_selected', nodeId: 'menu', optionId: 'codigo',
    }));
  });

  it('sends list and text nodes as they are configured', async () => {
    const definition = withDefinition((d) => {
      d.nodes.push({
        id: 'ayuda', name: 'Ayuda', kind: 'list', body: 'Elige un tema', listButtonLabel: 'Ver temas',
        options: [{ id: 'pagos', title: 'Pagos', description: 'Cómo pagar', next: 'gracias' }],
      }, { id: 'gracias', name: 'Gracias', kind: 'text', body: 'Gracias por escribir', options: [] });
      d.nodes[0].options.push({ id: 'ayuda', title: 'Ayuda', next: 'ayuda' });
    });
    const list = setup({ definition });
    await expect(handleBotMessage(tap('BOT:menu:ayuda'), list.deps)).resolves.toBe('node');
    expect(sentPayload(list.send)).toEqual({
      kind: 'list', body: 'Elige un tema', buttonLabel: 'Ver temas',
      rows: [{ id: 'BOT:ayuda:pagos', title: 'Pagos', description: 'Cómo pagar' }],
    });
    const text = setup({ definition });
    await expect(handleBotMessage(tap('BOT:ayuda:pagos', 'list_reply'), text.deps)).resolves.toBe('node');
    expect(sentPayload(text.send)).toEqual({ kind: 'text', text: 'Gracias por escribir' });
  });

  it('runs the action an action node connects and uses the published handoff wording', async () => {
    const { deps, send, record } = setup({ definition: withDefinition((d) => { d.messages.handoff_ack = 'Un asesor te escribe pronto.'; }) });
    await expect(handleBotMessage(tap('BOT:menu:soporte'), deps)).resolves.toBe('handoff');
    expect(sentText(send)).toBe('Un asesor te escribe pronto.');
    expect(eventTypes(record)).toEqual(['option_selected', 'handoff']);
  });

  it.each([
    ['the node no longer exists', 'BOT:viejo:codigo'], ['the option no longer exists', 'BOT:menu:viejo'],
  ])('tells the customer and offers the menu again when %s', async (_label, id) => {
    const { deps, send, record } = setup();
    await expect(handleBotMessage(tap(id), deps)).resolves.toBe('option_unavailable');
    expect(send).toHaveBeenCalledOnce();
    expect(sentPayload(send)).toMatchObject({
      kind: 'buttons', body: expect.stringContaining(MESSAGES.option_unavailable), buttons: [{ id: 'BOT:menu:codigo' }, { id: 'BOT:menu:soporte' }],
    });
    expect(sentPayload(send).body).toContain('Hola, soy el asistente');
    expect(eventTypes(record)).toEqual(['option_unavailable']);
  });

  it('only tells the customer when the entry node cannot be shown', async () => {
    const { deps, send } = setup({ definition: withDefinition((d) => { d.entryNodeId = 'inexistente'; }) });
    await expect(handleBotMessage(tap('BOT:viejo:codigo'), deps)).resolves.toBe('option_unavailable');
    expect(sentPayload(send)).toEqual({ kind: 'text', text: MESSAGES.option_unavailable });
  });

  it('treats an action node without an action as nothing to do instead of failing', async () => {
    const { deps, send } = setup({ definition: withDefinition((d) => { delete d.nodes[2].action; }) });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('ignored');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('menu settings of the published bot', () => {
  it('offers the entry node on the configured keywords and records it', async () => {
    const definition = withDefinition((d) => { d.keywords = ['promo']; });
    const hit = setup({ definition, lastActivityAt: minutesAgo(5) });
    await expect(handleBotMessage(inbound({ textBody: 'Una PROMO?' }), hit.deps)).resolves.toBe('menu');
    expect(hit.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'menu_shown', nodeId: 'menu' }));
    const miss = setup({ definition, lastActivityAt: minutesAgo(5) });
    await expect(handleBotMessage(inbound({ textBody: 'hola' }), miss.deps)).resolves.toBe('ignored');
  });

  it('uses the configured idle hours', async () => {
    const definition = withDefinition((d) => { d.params.menuIdleHours = 1; });
    const { deps } = setup({ definition, lastActivityAt: minutesAgo(90) });
    await expect(handleBotMessage(inbound({ textBody: 'gracias' }), deps)).resolves.toBe('menu');
    const quiet = setup({ lastActivityAt: minutesAgo(90) });
    await expect(handleBotMessage(inbound({ textBody: 'gracias' }), quiet.deps)).resolves.toBe('ignored');
  });

  it('uses the configured quiet time after a person answered, and skips the check when it is 0', async () => {
    const custom = setup({ definition: withDefinition((d) => { d.params.operatorQuietMinutes = 10; }), operator: true });
    await handleBotMessage(inbound(), custom.deps);
    expect(custom.store.operatorRepliedSince).toHaveBeenCalledWith(waId, minutesAgo(10));
    const off = setup({ definition: withDefinition((d) => { d.params.operatorQuietMinutes = 0; }), operator: true });
    await expect(handleBotMessage(inbound(), off.deps)).resolves.toBe('menu');
    expect(off.store.operatorRepliedSince).not.toHaveBeenCalled();
  });

  it('runs an action when the administrator made it the entry node', async () => {
    const { deps, send } = setup({ definition: withDefinition((d) => { d.entryNodeId = 'soporte'; }) });
    await expect(handleBotMessage(inbound(), deps)).resolves.toBe('handoff');
    expect(sentText(send)).toBe(MESSAGES.handoff_ack);
  });

  it('stays quiet when the entry node does not exist', async () => {
    const { deps, send } = setup({ definition: withDefinition((d) => { d.entryNodeId = 'inexistente'; }) });
    await expect(handleBotMessage(inbound(), deps)).resolves.toBe('ignored');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('published wording and numbers', () => {
  it('renders the markers of the sign-in code message', async () => {
    const definition = withDefinition((d) => { d.messages.login_code_sent = 'Clave {{codigo}} (vale {{minutos}} min)'; d.params.loginWindowMinutes = 3; });
    const { deps, send } = setup({ definition, mails: [loginMail('netflix008@movietimepty.top', '3916', 1)] });
    await handleBotMessage(tap(LOGIN), deps);
    expect(sentText(send)).toBe('Clave 3916 (vale 3 min)');
    expect(send.mock.calls[0][0].storedTextBody).toBe('Código de Netflix enviado (oculto).');
  });

  it('renders the profile in the travel code and the link messages', async () => {
    const definition = withDefinition((d) => {
      d.messages.travel_code_sent = 'Perfil {{perfil}}: {{codigo}} ({{minutos}})';
      d.messages.travel_link_sent = 'Abre {{enlace}} en {{minutos}}';
    });
    const code = setup({ definition, mails: [travelMail('netflix008@movietimepty.top', 'Ana María', 1)], page: '<div class="challenge-code">4003</div>' });
    await handleBotMessage(tap(TRAVEL), code.deps);
    expect(sentText(code.send)).toBe('Perfil Ana María: 4003 (15)');
    const link = setup({ definition, mails: [travelMail('netflix008@movietimepty.top', 'Ana María', 1)] });
    await handleBotMessage(tap(TRAVEL), link.deps);
    expect(sentText(link.send)).toBe(`Abre ${verifyUrl} en 15`);
    expect(link.send.mock.calls[0][0].storedTextBody).not.toContain('nftoken');
  });

  it.each([
    ['without the code marker', 'Tu clave llegó'], ['with a marker that has spaces', 'Tu clave {{ codigo }}'], ['empty', '   '],
  ])('never sends a code message %s: it falls back to the default wording', async (_label, broken) => {
    const { deps, send } = setup({
      definition: withDefinition((d) => { d.messages.login_code_sent = broken; }), mails: [loginMail('netflix008@movietimepty.top', '3916', 1)],
    });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('code');
    expect(sentText(send)).toContain('*3916*');
    expect(sentText(send)).not.toContain('{{');
  });

  it('falls back when a link message lost the link marker', async () => {
    const { deps, send } = setup({
      definition: withDefinition((d) => { d.messages.travel_link_sent = 'Revisa tu correo'; }),
      mails: [travelMail('netflix008@movietimepty.top', 'Ana María', 1)],
    });
    await handleBotMessage(tap(TRAVEL), deps);
    expect(sentText(send)).toContain(verifyUrl);
  });

  it('renders markers without a value as empty instead of showing them', async () => {
    const { deps, send } = setup({ definition: withDefinition((d) => { d.messages.handoff_ack = 'Hola{{perfil}}{{codigo}}.'; }) });
    await handleBotMessage(tap('BOT:menu:soporte'), deps);
    expect(sentText(send)).toBe('Hola.');
  });

  it('uses the configured windows for each kind of mail', async () => {
    const login = setup({
      definition: withDefinition((d) => { d.params.loginWindowMinutes = 2; }), mails: [loginMail('netflix008@movietimepty.top', '1111', 3)],
    });
    await expect(handleBotMessage(tap(LOGIN), login.deps)).resolves.toBe('not_found');
    expect(login.recent).toHaveBeenCalledWith(new Date(now.getTime() - 3 * 60_000));
    expect(sentPayload(login.send).body).toContain('2 minutos');
    const travel = setup({
      definition: withDefinition((d) => { d.params.travelWindowMinutes = 3; }), mails: [travelMail('netflix008@movietimepty.top', 'Ana María', 4)],
    });
    await expect(handleBotMessage(tap(TRAVEL), travel.deps)).resolves.toBe('not_found');
    expect(sentPayload(travel.send).body).toContain('3 minutos');
  });

  it('uses the configured tap limit and window', async () => {
    const strict = setup({ definition: withDefinition((d) => { d.params.maxTaps = 2; d.params.tapWindowMinutes = 30; }), taps: 3 });
    await expect(handleBotMessage(tap(LOGIN), strict.deps)).resolves.toBe('limited');
    expect(strict.store.menuTapsSince).toHaveBeenCalledWith(waId, minutesAgo(30));
    expect(sentText(strict.send)).toContain('30 minutos');
    const allowed = setup({ definition: withDefinition((d) => { d.params.maxTaps = 2; }), taps: 2, inbox: 'none' });
    await expect(handleBotMessage(tap(LOGIN), allowed.deps)).resolves.toBe('unavailable');
  });

  it('uses the published wording of the account picker', async () => {
    const definition = withDefinition((d) => { d.messages.account_picker_body = '¿Cuál cuenta?'; d.messages.account_picker_button = 'Cuentas'; });
    const { deps, send } = setup({
      definition, services: [serviceA, serviceB],
      mails: [loginMail('netflix002@movietimepty.top', '2222', 1), loginMail('netflix008@movietimepty.top', '1111', 2)],
    });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('list');
    expect(sentPayload(send)).toMatchObject({ body: '¿Cuál cuenta?', buttonLabel: 'Cuentas' });
  });

  it('offers the retry button of the published flow, or plain text when the flow has none', async () => {
    const renamed = setup({
      definition: withDefinition((d) => { d.nodes[1].options[0].title = 'Pedir código'; }), mails: [],
    });
    await handleBotMessage(tap(LOGIN), renamed.deps);
    expect(sentPayload(renamed.send)).toMatchObject({ kind: 'buttons', buttons: [{ id: LOGIN, title: 'Pedir código' }] });
    const bare = setup({ definition: withDefinition((d) => { d.nodes[1].options = []; }), mails: [] });
    await handleBotMessage(tap('BOT:NFX:LOGIN'), bare.deps);
    expect(sentPayload(bare.send).kind).toBe('text');
  });
});

describe('bot events', () => {
  it.each([
    ['a sign-in code', () => setup({ mails: [loginMail('netflix008@movietimepty.top', '3916', 1)] }), LOGIN, 'code_sent'],
    ['a travel link', () => setup({ mails: [travelMail('netflix008@movietimepty.top', 'Ana María', 1)] }), TRAVEL, 'link_sent'],
    ['a missing mail', () => setup(), LOGIN, 'not_found'],
    ['an unreadable mailbox', () => setup({ inbox: 'none' }), LOGIN, 'mailbox_unavailable'],
    ['too many taps', () => setup({ taps: 9 }), LOGIN, 'rate_limited'],
    ['no Netflix account', () => setup({ services: [] }), LOGIN, 'not_found'],
    ['a missing profile', () => setup({ services: [serviceNoProfile] }), TRAVEL, 'profile_blocked'],
    ['a mail already delivered', () => setup({ mails: [loginMail('netflix008@movietimepty.top', '1111', 1)], claimResult: 'mine' }), LOGIN, 'already_sent'],
    ['a failed delivery', () => setup({ mails: [loginMail('netflix008@movietimepty.top', '1111', 1)], sendStatus: 'failed' }), LOGIN, 'error'],
  ] as const)('records %s', async (_label, build, id, type) => {
    const { deps, record } = build();
    await handleBotMessage(tap(id), deps);
    expect(eventTypes(record)).toContain(type);
    expect(record.mock.calls.every(([event]) => event.waId === waId && event.clienteId === 'c1')).toBe(true);
  });

  it('blocks a travel request of another profile and says so in the event', async () => {
    const { deps, record } = setup({ mails: [travelMail('netflix008@movietimepty.top', 'Pedro', 1)] });
    await handleBotMessage(tap(TRAVEL), deps);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      type: 'profile_blocked', detail: { tipo: 'travel', motivo: 'otro_perfil', solicitudes: 1 },
    }));
  });

  it('records why nothing was delivered when another customer already has the mail', async () => {
    const { deps, record } = setup({
      mails: [loginMail('netflix008@movietimepty.top', '1111', 1)], owners: { [keyOf('<1111@ejemplo.test>')]: '50760000000' },
    });
    await handleBotMessage(tap(LOGIN), deps);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ type: 'not_found', detail: { tipo: 'login', motivo: 'entregado_a_otro' } }));
  });

  it('records the account picker and the already delivered answer', async () => {
    const list = setup({
      services: [serviceA, serviceB],
      mails: [loginMail('netflix002@movietimepty.top', '2222', 1), loginMail('netflix008@movietimepty.top', '1111', 2)],
    });
    await handleBotMessage(tap(LOGIN), list.deps);
    expect(eventTypes(list.record)).toContain('menu_shown');
    const delivered = setup({ mails: [loginMail('netflix008@movietimepty.top', '1111', 1)], owners: { [keyOf('<1111@ejemplo.test>')]: waId } });
    await handleBotMessage(tap(LOGIN), delivered.deps);
    expect(eventTypes(delivered.record)).toContain('already_sent');
  });

  it('never puts a code, a link or a password in an event', async () => {
    const login = setup({ mails: [loginMail('netflix008@movietimepty.top', '3916', 1)] });
    await handleBotMessage(tap(LOGIN), login.deps);
    const travel = setup({ mails: [travelMail('netflix008@movietimepty.top', 'Ana María', 1)], page: '<div class="challenge-code">4003</div>' });
    await handleBotMessage(tap(TRAVEL), travel.deps);
    const recorded = JSON.stringify([...login.record.mock.calls, ...travel.record.mock.calls]);
    expect(recorded).not.toMatch(/3916|4003|nftoken|netflix\.com|password/i);
    expect(recorded).toContain('netflix008@movietimepty.top');
  });

  it('keeps answering the customer when an event cannot be recorded', async () => {
    const { deps, send, claims } = setup({ eventsThrow: true, mails: [loginMail('netflix008@movietimepty.top', '3916', 1)] });
    await expect(handleBotMessage(tap(LOGIN), deps)).resolves.toBe('code');
    expect(sentText(send)).toContain('3916');
    expect(claims.release).not.toHaveBeenCalled();
    const menu = setup({ eventsThrow: true, lastActivityAt: minutesAgo(13 * 60) });
    await expect(handleBotMessage(inbound({ textBody: 'gracias' }), menu.deps)).resolves.toBe('menu');
  });
});

describe('handleBotMessage: quien recibe el recorrido', () => {
  it('un cliente conocido recibe el menu aunque no tenga Netflix, y los códigos siguen pidiendo una cuenta propia', async () => {
    const other = setup({ services: [], hasServices: true });
    await expect(handleBotMessage(inbound(), other.deps)).resolves.toBe('menu');
    expect(sentPayload(other.send)).toMatchObject({ kind: 'buttons' });
    const code = setup({ services: [], hasServices: true });
    await expect(handleBotMessage(tap(LOGIN), code.deps)).resolves.toBe('none');
    expect(sentText(code.send)).toBe(MESSAGES.no_netflix_account);
  });

  it('un contacto desconocido con número de Panamá recibe el recorrido; los demás números desconocidos, nada', async () => {
    const lead = setup({ known: false, services: [], hasServices: false });
    await expect(handleBotMessage(inbound(), lead.deps)).resolves.toBe('menu');
    expect(lead.send).toHaveBeenCalledTimes(1);
    const abroad = setup({ known: false, services: [] });
    await expect(handleBotMessage(inbound({ fromWaId: '15551234567' }), abroad.deps)).resolves.toBe('ignored');
    await expect(handleBotMessage({ ...tap(LOGIN), fromWaId: ABROAD }, abroad.deps)).resolves.toBe('ignored');
    expect(abroad.send).not.toHaveBeenCalled();
  });

  it('un cliente conocido con número del extranjero también recibe el recorrido', async () => {
    const known = setup({ known: true });
    await expect(handleBotMessage(inbound({ fromWaId: '15551234567' }), known.deps)).resolves.toBe('menu');
  });
});

// "soporte" (acción de atención) pasa a ser la acción de compras indicada; la entrada del recorrido es el menú.
const withAction = (action: BotActionKey, entry?: string): BotDefinition => {
  const def = updateNode(defaultDefinition(), 'soporte', { action });
  return entry ? { ...def, entryNodeId: entry } : def;
};
function withBlocks(): BotDefinition {
  const flow = addOption(addPurchaseFlow(defaultDefinition()), 'menu');
  return connectOption(flow, 'menu', flow.nodes.find((node) => node.id === 'menu')!.options.at(-1)!.id, 'compra_catalogo');
}
const menuBody = defaultDefinition().nodes[0].body;
const ABROAD = '15551234567';

describe('handleBotMessage: nodos de compra del recorrido', () => {
  it('delega al flujo de compras sin enviar nada: el nodo nunca se manda como texto', async () => {
    for (const [action, step] of [['purchase', 'buy'], ['renewal', 'renew'], ['my_services', 'services']] as const) {
      const { deps, send } = setup({ definition: withAction(action) });
      await expect(handleBotMessage(tap('BOT:menu:soporte'), deps)).resolves.toEqual({ delegate: step });
      expect(send).not.toHaveBeenCalled();
    }
    const blocks = withBlocks();
    const catalog = setup({ definition: blocks });
    const added = blocks.nodes.find((node) => node.id === 'menu')!.options.at(-1)!.id;
    await expect(handleBotMessage(tap(`BOT:menu:${added}`), catalog.deps)).resolves.toEqual({ delegate: 'buy' });
    const summary = setup({ definition: blocks });
    await expect(handleBotMessage(tap('BOT:compra_catalogo:resumen'), summary.deps)).resolves.toEqual({ delegate: 'summary' });
    expect(catalog.send).not.toHaveBeenCalled();
  });

  it('también delega cuando llega a la compra a través de una condición, para clientes nuevos y existentes', async () => {
    let def = addConditionNode(withAction('purchase'), 'customer_has_services');
    const id = def.nodes.at(-1)!.id;
    def = connectOption(connectOption(def, id, 'si', 'soporte'), id, 'no', 'soporte');
    def = connectOption(def, 'menu', 'soporte', id);
    for (const hasServices of [true, false]) {
      const { deps, send } = setup({ definition: def, services: [], hasServices });
      await expect(handleBotMessage(tap('BOT:menu:soporte'), deps)).resolves.toEqual({ delegate: 'buy' });
      expect(send).not.toHaveBeenCalled();
    }
  });

  it('una entrada que es un nodo de compra delega al empezar', async () => {
    const { deps, send } = setup({ definition: withAction('purchase', 'soporte') });
    await expect(handleBotMessage(inbound(), deps)).resolves.toEqual({ delegate: 'buy' });
    expect(send).not.toHaveBeenCalled();
  });

  it('una opción que ya no existe delega con el aviso cuando la entrada es una compra', async () => {
    const { deps } = setup({ definition: withAction('purchase', 'soporte') });
    await expect(handleBotMessage(tap('BOT:viejo:codigo'), deps)).resolves.toEqual({ delegate: 'buy', prefix: MESSAGES.option_unavailable });
  });

  it('un número que el flujo de compras no atiende recibe el aviso de opción no disponible y la entrada, en un solo mensaje', async () => {
    const { deps, send, record } = setup({ definition: withAction('purchase') });
    await expect(handleBotMessage({ ...tap('BOT:menu:soporte'), fromWaId: ABROAD }, deps)).resolves.toBe('option_unavailable');
    expect(send).toHaveBeenCalledTimes(1);
    expect(sentPayload(send)).toMatchObject({ kind: 'buttons', body: `${MESSAGES.option_unavailable}\n\n${menuBody}` });
    expect(eventTypes(record)).toContain('option_unavailable');
  });

  it('si la entrada también es una compra, el número sin compras recibe solo el aviso', async () => {
    const { deps, send } = setup({ definition: withAction('purchase', 'soporte') });
    await expect(handleBotMessage({ ...inbound({ textBody: 'hola' }), fromWaId: ABROAD }, deps)).resolves.toBe('option_unavailable');
    expect(send).toHaveBeenCalledTimes(1);
    expect(sentPayload(send)).toEqual({ kind: 'text', text: MESSAGES.option_unavailable });
  });

  it('si la entrada es una acción, el número sin compras solo recibe el aviso', async () => {
    const def = { ...withAction('purchase'), entryNodeId: 'login' };
    const { deps, send } = setup({ definition: def });
    await expect(handleBotMessage({ ...tap('BOT:menu:soporte'), fromWaId: ABROAD }, deps)).resolves.toBe('option_unavailable');
    expect(sentPayload(send)).toEqual({ kind: 'text', text: MESSAGES.option_unavailable });
  });
});

describe('handleBotMessage: el flujo de compras devuelve el turno', () => {
  const back = (text = 'Listo, cancelé tu selección.', block: BotHandBack['block'] = null, prefixed = true): { handBack: BotHandBack } => ({ handBack: { text, prefixed, block } });
  const written = () => inbound({ textBody: 'cancelar' });

  it('envía el aviso y la entrada en un solo mensaje, aunque el cliente escriba texto, y sin pasar por las reglas del menú', async () => {
    const { deps, send, store } = setup({ lastActivityAt: minutesAgo(1), operator: true });
    await expect(handleBotMessage(written(), deps, back())).resolves.toBe('node');
    expect(send).toHaveBeenCalledTimes(1);
    expect(sentPayload(send)).toMatchObject({ kind: 'buttons', body: `Listo, cancelé tu selección.\n\n${menuBody}` });
    expect(store.operatorRepliedSince).not.toHaveBeenCalled();
    const media = setup();
    await expect(handleBotMessage(inbound({ messageType: 'image', textBody: null }), media.deps, back())).resolves.toBe('node');
  });

  it('sin aviso por delante (hola/menu) muestra solo la entrada', async () => {
    const { deps, send } = setup();
    await handleBotMessage(written(), deps, back('Por ahora no tengo opciones.', null, false));
    expect(sentPayload(send)).toMatchObject({ kind: 'buttons', body: menuBody });
  });

  it('también atiende a un contacto desconocido de Panamá y a quien no tiene Netflix', async () => {
    const lead = setup({ known: false, services: [], hasServices: false });
    await expect(handleBotMessage(written(), lead.deps, back())).resolves.toBe('node');
    const abroad = setup({ known: false, services: [] });
    await expect(handleBotMessage({ ...written(), fromWaId: ABROAD }, abroad.deps, back())).resolves.toBe('ignored');
    expect(abroad.send).not.toHaveBeenCalled();
  });

  it('cancelar en un bloque lleva al nodo que su salida conecta; si no existe, a la entrada', async () => {
    const def = connectOption(withBlocks(), 'compra_resumen', 'cancel', 'soporte');
    const handoff = setup({ definition: def });
    await expect(handleBotMessage(written(), handoff.deps, back('Listo, cancelé tu selección.', 'resumen'))).resolves.toBe('handoff');
    expect(sentPayload(handoff.send)).toEqual({ kind: 'text', text: `Listo, cancelé tu selección.\n\n${MESSAGES.handoff_ack}` });
    const entry = setup({ definition: withBlocks() });
    await handleBotMessage(written(), entry.deps, back('Listo.', 'resumen'));
    expect(sentPayload(entry.send)).toMatchObject({ body: `Listo.\n\n${menuBody}` });
    const noBlocks = setup();
    await handleBotMessage(written(), noBlocks.deps, back('Listo.', 'reserva'));
    expect(sentPayload(noBlocks.send)).toMatchObject({ body: `Listo.\n\n${menuBody}` });
    const noCancel = setup({ definition: withBlocks() });
    await handleBotMessage(written(), noCancel.deps, back('Listo.', 'catalogo'));
    expect(sentPayload(noCancel.send)).toMatchObject({ body: `Listo.\n\n${menuBody}` });
  });

  it('si el destino es otro nodo de compra solo dice el aviso, nunca delega de nuevo', async () => {
    const def = connectOption(withBlocks(), 'compra_resumen', 'cancel', 'compra_catalogo');
    const toBlock = setup({ definition: def });
    await expect(handleBotMessage(written(), toBlock.deps, back('Aviso.', 'resumen'))).resolves.toBe('node');
    expect(sentPayload(toBlock.send)).toEqual({ kind: 'text', text: 'Aviso.' });
    const entryIsPurchase = setup({ definition: withAction('my_services', 'soporte') });
    await expect(handleBotMessage(written(), entryIsPurchase.deps, back('No encuentro servicios.'))).resolves.toBe('node');
    expect(sentPayload(entryIsPurchase.send)).toEqual({ kind: 'text', text: 'No encuentro servicios.' });
  });

  it('si el recorrido no tiene nada que mostrar, el cliente igual recibe la respuesta del flujo de compras', async () => {
    const noEntry = setup({ definition: { ...defaultDefinition(), entryNodeId: 'inexistente' } });
    await expect(handleBotMessage(written(), noEntry.deps, back('Aviso.'))).resolves.toBe('node');
    expect(sentPayload(noEntry.send)).toEqual({ kind: 'text', text: 'Aviso.' });
    let def = addConditionNode(defaultDefinition(), 'catalog_has_stock');
    const id = def.nodes.at(-1)!.id;
    def = setEntryNode({ ...def, nodes: def.nodes.map((node) => (node.id === id ? { ...node, options: [] } : node)) }, id);
    const dead = setup({ definition: def });
    await expect(handleBotMessage(written(), dead.deps, back('Aviso.'))).resolves.toBe('node');
    expect(sentPayload(dead.send)).toEqual({ kind: 'text', text: 'Aviso.' });
  });
});
