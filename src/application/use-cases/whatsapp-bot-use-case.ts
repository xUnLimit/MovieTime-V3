import { createHash } from 'node:crypto';

import { createLogger } from '@/platform/observability/logger';
import type { NetflixInbox } from '@/platform/server/netflix-imap';
import type { BotService, BotStore } from '@/modules/messaging/bot-store';
import { latestMailByAccount, NETFLIX_CODE_MAX_AGE_MS, type DatedNetflixMail } from '@/modules/netflix/latest-mails';
import { parseNetflixMail } from '@/modules/netflix/parse-mail';
import { parseTravelCode } from '@/modules/netflix/travel-code';
import {
  accountListMessage, BOT_OPERATOR_QUIET_MS, botTexts, menuMessage, readBotAction, retryMessage, shouldShowMenu,
  type BotAction,
} from '@/modules/whatsapp/bot-menu';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { NewOutboundMessage, OutboundResult } from '@/modules/whatsapp/outbound-messages';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';

const log = createLogger('WhatsAppBot');
const MAX_MENU_TAPS = 6;
const TAP_WINDOW_MS = 10 * 60 * 1000;

export type BotDeps = {
  store: BotStore;
  // null when the mailbox is not configured.
  openInbox: () => Promise<NetflixInbox | null>;
  fetchTravelPage: (url: string) => Promise<string | null>;
  send: (message: NewOutboundMessage) => Promise<OutboundResult>;
  now?: () => Date;
};

export type BotResult = 'ignored' | 'menu' | 'support' | 'limited' | 'none' | 'unavailable'
  | 'retry' | 'list' | 'code' | 'link';

function replyKey(waMessageId: string): string {
  const hex = createHash('sha256').update(`bot-reply:${waMessageId}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function reply(
  deps: BotDeps, message: InboundMessage, payload: OutboundPayload, storedTextBody?: string,
): Promise<void> {
  await deps.send({
    idempotencyKey: replyKey(message.waMessageId), toWaId: message.fromWaId, payload, sentBy: null,
    ...(storedTextBody ? { storedTextBody } : {}),
  });
}

async function readRecentMails(inbox: NetflixInbox, since: Date): Promise<DatedNetflixMail[]> {
  const mails: DatedNetflixMail[] = [];
  for (const raw of await inbox.recent(since)) {
    const mail = parseNetflixMail(raw.html);
    if (mail) mails.push({ receivedAt: raw.receivedAt, mail });
  }
  return mails;
}

async function deliver(deps: BotDeps, message: InboundMessage, item: DatedNetflixMail): Promise<BotResult> {
  if (item.mail.kind === 'login_code') {
    await reply(deps, message, { kind: 'text', text: botTexts.code(item.mail.code), replyTo: message.waMessageId }, botTexts.codeStored);
    return 'code';
  }
  let code: string | null = null;
  try {
    const page = await deps.fetchTravelPage(item.mail.verifyUrl);
    code = page ? parseTravelCode(page) : null;
  } catch {
    log.warn('Netflix travel page could not be read');
  }
  if (code) {
    await reply(deps, message, { kind: 'text', text: botTexts.code(code), replyTo: message.waMessageId }, botTexts.codeStored);
    return 'code';
  }
  // The page was not readable from the server; the customer opens the link himself.
  await reply(deps, message, { kind: 'text', text: botTexts.link(item.mail.verifyUrl), replyTo: message.waMessageId }, botTexts.linkStored);
  return 'link';
}

async function requestNetflixCode(
  deps: BotDeps, message: InboundMessage, services: BotService[], serviceId: string | null, now: Date,
): Promise<BotResult> {
  const taps = await deps.store.menuTapsSince(message.fromWaId, new Date(now.getTime() - TAP_WINDOW_MS).toISOString());
  if (taps > MAX_MENU_TAPS) {
    await reply(deps, message, { kind: 'text', text: botTexts.limited });
    return 'limited';
  }
  const owned = serviceId ? services.filter((service) => service.serviceId === serviceId) : services;
  if (owned.length === 0) {
    await reply(deps, message, { kind: 'text', text: botTexts.none });
    return 'none';
  }
  let latest: Map<string, DatedNetflixMail>;
  try {
    const inbox = await deps.openInbox();
    if (!inbox) throw new Error('Netflix mailbox is not configured');
    try {
      const mails = await readRecentMails(inbox, new Date(now.getTime() - NETFLIX_CODE_MAX_AGE_MS - 60_000));
      latest = latestMailByAccount(mails, new Set(owned.map((service) => service.email)), now);
    } finally {
      await inbox.close().catch(() => log.warn('Netflix mailbox did not close cleanly'));
    }
  } catch {
    log.warn('Netflix mailbox could not be read');
    await reply(deps, message, { kind: 'text', text: botTexts.unavailable });
    return 'unavailable';
  }
  const candidates = owned.flatMap((service) => {
    const item = latest.get(service.email);
    return item ? [{ service, item }] : [];
  });
  if (candidates.length === 0) {
    await reply(deps, message, retryMessage);
    return 'retry';
  }
  if (candidates.length > 1) {
    await reply(deps, message, accountListMessage(candidates.map((candidate) => candidate.service)));
    return 'list';
  }
  return deliver(deps, message, candidates[0].item);
}

async function handleAction(
  deps: BotDeps, message: InboundMessage, action: BotAction, services: BotService[], now: Date,
): Promise<BotResult> {
  if (action.kind === 'support') {
    await reply(deps, message, { kind: 'text', text: botTexts.support });
    return 'support';
  }
  return requestNetflixCode(deps, message, services, action.serviceId, now);
}

// Answers a registered customer's menu taps and, when it is appropriate, offers the
// menu. Unknown numbers never get an automatic reply.
export async function handleBotMessage(message: InboundMessage, deps: BotDeps): Promise<BotResult> {
  const action = readBotAction(message);
  const text = message.messageType === 'text' ? message.textBody : null;
  if (!action && text === null) return 'ignored';
  const { known, services } = await deps.store.customerServices(message.fromWaId);
  if (!known) return 'ignored';
  const now = deps.now?.() ?? new Date();
  if (action) return handleAction(deps, message, action, services, now);
  // Without a Netflix account the only menu option left would be support.
  if (services.length === 0) return 'ignored';
  const [lastActivityAt, operatorRepliedRecently] = await Promise.all([
    deps.store.lastActivityAt(message.fromWaId, message.waMessageId),
    deps.store.operatorRepliedSince(message.fromWaId, new Date(now.getTime() - BOT_OPERATOR_QUIET_MS).toISOString()),
  ]);
  if (!shouldShowMenu({ text, lastActivityAt, operatorRepliedRecently, now })) return 'ignored';
  await reply(deps, message, menuMessage);
  return 'menu';
}
