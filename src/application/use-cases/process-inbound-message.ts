import { handleNoticeReply, type NoticeReplyDeps, type NoticeReplyResult } from '@/application/use-cases/notice-reply-use-case';
import type { InboundQueueStore } from '@/modules/whatsapp/inbound-queue-store';
import type { NewOutboundMessage, OutboundResult } from '@/modules/whatsapp/outbound-messages';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import { createLogger } from '@/platform/observability/logger';

const log = createLogger('InboundMessagePipeline');

export type InboundPipelineDeps = {
  notice: NoticeReplyDeps;
  bot: { handle(message: InboundMessage, send: (outbound: NewOutboundMessage) => Promise<OutboundResult>): Promise<unknown> };
  send: (outbound: NewOutboundMessage) => Promise<OutboundResult>;
};

// 'done': nothing is left to do (replied, ignored or handed to the notice-reply retry queue).
// 'failed': an unexpected error; the message must stay in the queue for another attempt.
export type InboundOutcome = { status: 'done' } | { status: 'failed'; label: string };

// Single pipeline for the first pass (after() of the webhook) and for the retry worker.
// Re-running it never double-sends: bot replies derive their idempotency key from waMessageId and
// notice replies go through claim_whatsapp_notice_reply (one reply per notice and action).
// `runBot` keeps the "bot only answers messages newly inserted" rule: Meta redeliveries pass false.
export async function processInboundMessage(
  message: InboundMessage, deps: InboundPipelineDeps, runBot: boolean,
): Promise<InboundOutcome> {
  let result: NoticeReplyResult;
  try {
    result = await handleNoticeReply(message, deps.notice);
    if (result === 'failed') log.warn('WhatsApp notice reply action failed');
  } catch {
    log.warn('WhatsApp notice reply could not be processed');
    return { status: 'failed', label: 'NOTICE_REPLY_ERROR' };
  }
  // The bot only answers what the notice-reply handler did not take.
  if (!runBot || result !== 'ignored') return { status: 'done' };
  try {
    await deps.bot.handle(message, deps.send);
  } catch {
    // Never log the inbound payload or rendered credentials.
    log.warn('WhatsApp bot could not answer the message');
    return { status: 'failed', label: 'BOT_ERROR' };
  }
  return { status: 'done' };
}

export type InboundRetryResult = { claimed: number; done: number; failed: number };

export async function retryPendingInboundMessages(
  deps: InboundPipelineDeps & { queue: InboundQueueStore }, limit: number, lockSeconds: number,
): Promise<InboundRetryResult> {
  const rows = await deps.queue.claim(limit, lockSeconds);
  const result: InboundRetryResult = { claimed: rows.length, done: 0, failed: 0 };
  for (const row of rows) {
    // A retry is for a message that was inserted but never fully processed, so the bot may answer.
    const outcome = await processInboundMessage(row.message, deps, true);
    try {
      await deps.queue.finish(row.id, outcome.status === 'done' ? null : outcome.label);
    } catch {
      log.warn('Inbound message could not be marked');
      result.failed++;
      continue;
    }
    if (outcome.status === 'done') result.done++;
    else result.failed++;
  }
  return result;
}
