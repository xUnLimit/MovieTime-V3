import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { InboundQueueStore } from '@/modules/whatsapp/inbound-queue-store';
import type { NewOutboundMessage, OutboundResult } from '@/modules/whatsapp/outbound-messages';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { BotDeps } from './bot-reply';
import { reply } from './bot-reply';
import { processInboundMessage, retryPendingInboundMessages, type InboundPipelineDeps } from './process-inbound-message';

const NOTICE_ID = '123e4567-e89b-12d3-a456-426614174000';
const text: InboundMessage = {
  waMessageId: 'wamid.TEXT', phoneNumberId: '1', fromWaId: '50760000000', contactName: null, messageType: 'text',
  textBody: 'Hola', sentAt: '2026-10-03T12:00:00.000Z', mediaId: null, mediaMimeType: null, mediaFilename: null,
  contextWaMessageId: null, reactionEmoji: null, payload: {},
};
const button: InboundMessage = {
  ...text, waMessageId: 'wamid.BTN', messageType: 'button',
  payload: { type: 'template_button', payload: `RENOVAR:${NOTICE_ID}` },
};
const accepted: OutboundResult = { id: NOTICE_ID, sendStatus: 'accepted', waMessageId: 'wamid.OUT', errorTitle: null, replayed: false };
const acceptedNotice = {
  status: 'accepted', wa_id: '50760000000', wa_message_id: 'x', tipo: 'notificacion_regular', created_at: '2026-10-03T11:00:00Z',
};

function deps() {
  const findNotice = vi.fn().mockResolvedValue(null);
  const send = vi.fn().mockResolvedValue(accepted);
  const handle = vi.fn().mockResolvedValue('menu');
  const pipeline: InboundPipelineDeps = {
    notice: { replies: { findNotice } as never, notices: {} as never, send, now: () => new Date('2026-10-03T12:00:00Z') },
    bot: { handle }, send,
  };
  return { pipeline, findNotice, handle, send };
}

describe('processInboundMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs the bot for a new message the notice handler ignores', async () => {
    const { pipeline, handle, send } = deps();
    await expect(processInboundMessage(text, pipeline, true)).resolves.toEqual({ status: 'done' });
    expect(handle).toHaveBeenCalledWith(text, send);
  });

  it('does not run the bot for a redelivered message', async () => {
    const { pipeline, handle } = deps();
    await expect(processInboundMessage(text, pipeline, false)).resolves.toEqual({ status: 'done' });
    expect(handle).not.toHaveBeenCalled();
  });

  it('reports a bot failure so the message stays queued', async () => {
    const { pipeline, handle } = deps();
    handle.mockRejectedValueOnce(new Error('boom'));
    await expect(processInboundMessage(text, pipeline, true)).resolves.toEqual({ status: 'failed', label: 'BOT_ERROR' });
  });

  it('reports a notice-reply failure so the message stays queued', async () => {
    const { pipeline, findNotice, handle } = deps();
    findNotice.mockRejectedValueOnce(new Error('db down'));
    await expect(processInboundMessage(button, pipeline, true)).resolves.toEqual({ status: 'failed', label: 'NOTICE_REPLY_ERROR' });
    expect(handle).not.toHaveBeenCalled();
  });
});

describe('retry idempotency', () => {
  it('derives the bot reply key only from the inbound waMessageId', async () => {
    const sent: NewOutboundMessage[] = [];
    const botDeps = { send: async (m: NewOutboundMessage) => { sent.push(m); return accepted; } } as unknown as BotDeps;
    await reply(botDeps, text, { kind: 'text', text: 'A' });
    await reply(botDeps, text, { kind: 'text', text: 'A' });
    await reply(botDeps, { ...text, waMessageId: 'wamid.OTHER' }, { kind: 'text', text: 'A' });
    expect(sent[0].idempotencyKey).toBe(sent[1].idempotencyKey);
    expect(sent[2].idempotencyKey).not.toBe(sent[0].idempotencyKey);
  });

  it('a retry of an already handled button sends nothing and never calls the bot', async () => {
    const { pipeline, findNotice, handle, send } = deps();
    findNotice.mockResolvedValue(acceptedNotice);
    const claim = vi.fn().mockResolvedValue({ id: 1, attempts: 1, outcome: 'duplicate' });
    pipeline.notice = { ...pipeline.notice, replies: { findNotice, claim } as never };
    await processInboundMessage(button, pipeline, true);
    await processInboundMessage(button, pipeline, true);
    expect(claim).toHaveBeenCalledWith(NOTICE_ID, 'RENOVAR', 'wamid.BTN');
    expect(send).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });
});

describe('retryPendingInboundMessages', () => {
  function queue(rows: Array<{ id: string; message: InboundMessage }>) {
    const store: InboundQueueStore = {
      claim: vi.fn().mockResolvedValue(rows), finish: vi.fn().mockResolvedValue(undefined),
    };
    return store;
  }

  it('marks processed rows and releases failed ones with their label', async () => {
    const { pipeline, handle } = deps();
    handle.mockResolvedValueOnce('menu').mockRejectedValueOnce(new Error('x'));
    const store = queue([{ id: 'r1', message: text }, { id: 'r2', message: { ...text, waMessageId: 'wamid.2' } }]);
    const result = await retryPendingInboundMessages({ ...pipeline, queue: store }, 10, 300);
    expect(store.claim).toHaveBeenCalledWith(10, 300);
    expect(store.finish).toHaveBeenCalledWith('r1', null);
    expect(store.finish).toHaveBeenCalledWith('r2', 'BOT_ERROR');
    expect(result).toEqual({ claimed: 2, done: 1, failed: 1 });
  });

  it('counts a row whose mark could not be written as failed and continues', async () => {
    const { pipeline } = deps();
    const store = queue([{ id: 'r1', message: text }, { id: 'r2', message: { ...text, waMessageId: 'wamid.2' } }]);
    vi.mocked(store.finish).mockRejectedValueOnce(new Error('db'));
    const result = await retryPendingInboundMessages({ ...pipeline, queue: store }, 10, 300);
    expect(result).toEqual({ claimed: 2, done: 1, failed: 1 });
  });

  it('does nothing for an empty queue', async () => {
    const { pipeline, handle } = deps();
    const result = await retryPendingInboundMessages({ ...pipeline, queue: queue([]) }, 10, 300);
    expect(result).toEqual({ claimed: 0, done: 0, failed: 0 });
    expect(handle).not.toHaveBeenCalled();
  });
});
