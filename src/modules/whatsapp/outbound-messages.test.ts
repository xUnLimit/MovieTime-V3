import { describe, expect, it, vi } from 'vitest';

import { CloudApiError } from './cloud-api-client';
import {
  CustomerWindowClosedError,
  InvalidTemplateParamsError,
  isWindowOpen,
  sendOutboundMessage,
  type NewOutboundMessage,
  type OutboundStore,
} from './outbound-messages';

const NOW = new Date('2026-09-27T12:00:00.000Z');
const now = () => NOW;

function fakeStore(overrides: Partial<OutboundStore> = {}) {
  return {
    findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    lastInboundAt: vi.fn().mockResolvedValue('2026-09-27T11:00:00.000Z'),
    insertPending: vi.fn().mockResolvedValue({ id: 'out-1', sendStatus: 'pending', waMessageId: null, errorTitle: null }),
    markAccepted: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies OutboundStore;
}

const textMessage: NewOutboundMessage = {
  idempotencyKey: '5b0f3c3e-8d8f-4c55-9a4b-3c9f1a2b7d10',
  toWaId: '50760000000',
  payload: { kind: 'text', text: 'Hola' },
  sentBy: 'admin-1',
};

const templateMessage: NewOutboundMessage = {
  ...textMessage,
  payload: { kind: 'template', templateName: 'vence_hoy', params: ['Netflix', '27/09/2026', '$4.50'] },
};

describe('isWindowOpen', () => {
  it.each([
    ['a message one hour ago', '2026-09-27T11:00:00.000Z', true],
    ['a message just under 24 hours ago', '2026-09-26T12:00:01.000Z', true],
    ['a message exactly 24 hours ago', '2026-09-26T12:00:00.000Z', false],
    ['no inbound message', null, false],
    ['a timestamp in the future', '2026-09-27T13:00:00.000Z', false],
  ])('treats %s correctly', (_label, lastInboundAt, expected) => {
    expect(isWindowOpen(lastInboundAt, NOW)).toBe(expected);
  });
});

describe('sendOutboundMessage', () => {
  it('reserves, sends and marks a text message as accepted inside the window', async () => {
    const store = fakeStore();
    const send = vi.fn().mockResolvedValue({ waMessageId: 'wamid.OUT' });

    await expect(sendOutboundMessage(textMessage, { store, send, now })).resolves.toEqual({
      id: 'out-1', sendStatus: 'accepted', waMessageId: 'wamid.OUT', errorTitle: null, replayed: false,
    });
    expect(store.insertPending).toHaveBeenCalledWith(textMessage);
    expect(send).toHaveBeenCalledWith('50760000000', { kind: 'text', text: 'Hola' });
    expect(store.markAccepted).toHaveBeenCalledWith('out-1', 'wamid.OUT');
  });

  it('returns the original result when the idempotency key was already used', async () => {
    const store = fakeStore({
      findByIdempotencyKey: vi.fn().mockResolvedValue({ id: 'out-0', sendStatus: 'accepted', waMessageId: 'wamid.OLD', errorTitle: null }),
    });
    const send = vi.fn();

    await expect(sendOutboundMessage(textMessage, { store, send, now }))
      .resolves.toMatchObject({ id: 'out-0', replayed: true });
    expect(send).not.toHaveBeenCalled();
    expect(store.insertPending).not.toHaveBeenCalled();
  });

  it('refuses free text when the customer has not written in 24 hours', async () => {
    const store = fakeStore({ lastInboundAt: vi.fn().mockResolvedValue('2026-09-25T12:00:00.000Z') });
    const send = vi.fn();

    await expect(sendOutboundMessage(textMessage, { store, send, now })).rejects.toBeInstanceOf(CustomerWindowClosedError);
    expect(store.insertPending).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends approved templates even when the window is closed', async () => {
    const store = fakeStore({ lastInboundAt: vi.fn().mockResolvedValue(null) });
    const send = vi.fn().mockResolvedValue({ waMessageId: 'wamid.TPL' });

    await expect(sendOutboundMessage(templateMessage, { store, send, now }))
      .resolves.toMatchObject({ sendStatus: 'accepted', waMessageId: 'wamid.TPL' });
    expect(store.lastInboundAt).not.toHaveBeenCalled();
  });

  it('rejects templates whose parameter count does not match', async () => {
    const store = fakeStore();
    const wrong: NewOutboundMessage = { ...templateMessage, payload: { kind: 'template', templateName: 'vence_hoy', params: ['Netflix'] } };

    await expect(sendOutboundMessage(wrong, { store, send: vi.fn(), now })).rejects.toBeInstanceOf(InvalidTemplateParamsError);
    expect(store.insertPending).not.toHaveBeenCalled();
  });

  it('records a Cloud API rejection as a failed message', async () => {
    const store = fakeStore();
    const send = vi.fn().mockRejectedValue(new CloudApiError(131026, 'Message undeliverable'));

    await expect(sendOutboundMessage(textMessage, { store, send, now })).resolves.toEqual({
      id: 'out-1', sendStatus: 'failed', waMessageId: null, errorTitle: 'Message undeliverable', replayed: false,
    });
    expect(store.markFailed).toHaveBeenCalledWith('out-1', 131026, 'Message undeliverable');
  });

  it('marks unexpected failures and rethrows them', async () => {
    const store = fakeStore();
    const send = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(sendOutboundMessage(textMessage, { store, send, now })).rejects.toThrow('boom');
    expect(store.markFailed).toHaveBeenCalledWith('out-1', null, 'Unexpected send failure');
  });

  it('returns the concurrent winner when another request reserved the same key', async () => {
    const findByIdempotencyKey = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'out-9', sendStatus: 'pending', waMessageId: null, errorTitle: null });
    const store = fakeStore({ findByIdempotencyKey, insertPending: vi.fn().mockResolvedValue(null) });
    const send = vi.fn();

    await expect(sendOutboundMessage(textMessage, { store, send, now }))
      .resolves.toMatchObject({ id: 'out-9', replayed: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('fails loudly if a reserved key vanishes', async () => {
    const store = fakeStore({ insertPending: vi.fn().mockResolvedValue(null) });

    await expect(sendOutboundMessage(textMessage, { store, send: vi.fn(), now }))
      .rejects.toThrow('Outbound message reservation disappeared.');
  });

  it('uses the current time by default', async () => {
    const store = fakeStore({ lastInboundAt: vi.fn().mockResolvedValue(new Date().toISOString()) });
    const send = vi.fn().mockResolvedValue({ waMessageId: 'wamid.NOW' });

    await expect(sendOutboundMessage(textMessage, { store, send })).resolves.toMatchObject({ sendStatus: 'accepted' });
  });
});
