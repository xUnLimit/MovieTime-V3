import { createHash } from 'node:crypto';

import { createLogger } from '@/platform/observability/logger';
import type { NetflixInbox } from '@/platform/server/netflix-imap';
import type { BotStore } from '@/modules/messaging/bot-store';
import type { BotEventsStore } from '@/modules/messaging/bot-events-store';
import type { NetflixClaimStore } from '@/modules/messaging/netflix-claim-store';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { NewOutboundMessage, OutboundResult } from '@/modules/whatsapp/outbound-messages';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { BotDefinition, BotEventType } from '@/types/bot';

const log = createLogger('WhatsAppBot');

export type BotDeps = {
  conversationOwner?: (waId: string) => Promise<'bot' | 'humano' | null>;
  store: BotStore;
  claims: NetflixClaimStore;
  events: Pick<BotEventsStore, 'record'>;
  // The published version of the bot: flow, wording and numbers. Loaded once per delivery.
  definition: BotDefinition;
  // null when the mailbox is not configured.
  openInbox: () => Promise<NetflixInbox | null>;
  fetchTravelPage: (url: string) => Promise<string | null>;
  send: (message: NewOutboundMessage) => Promise<OutboundResult>;
  now?: () => Date;
};

export type BotResult = 'ignored' | 'menu' | 'node' | 'handoff' | 'option_unavailable' | 'limited' | 'none' | 'no_profile'
  | 'unavailable' | 'retry' | 'already_sent' | 'list' | 'code' | 'link' | 'send_failed';

// What one inbound message needs to be answered: who wrote, when, and the published bot.
export type BotRun = { deps: BotDeps; message: InboundMessage; now: Date; clienteId: string | null };

function replyKey(waMessageId: string): string {
  const hex = createHash('sha256').update(`bot-reply:${waMessageId}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// One reply per inbound message: the key derives from it, so a redelivery never answers twice.
export function reply(
  deps: BotDeps, message: InboundMessage, payload: OutboundPayload, storedTextBody?: string,
): Promise<OutboundResult> {
  return deps.send({
    idempotencyKey: replyKey(message.waMessageId), toWaId: message.fromWaId, payload, sentBy: null,
    ...(storedTextBody ? { storedTextBody } : {}),
  });
}

// An event that cannot be recorded must never change what the customer receives.
export async function trackEvent(
  run: BotRun, type: BotEventType,
  fields: { nodeId?: string | null; optionId?: string | null; detail?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await run.deps.events.record({ waId: run.message.fromWaId, clienteId: run.clienteId, type, ...fields });
  } catch {
    log.warn('Bot event could not be recorded', { type });
  }
}
