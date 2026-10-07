import { createHash } from 'node:crypto';

import { createLogger } from '@/platform/observability/logger';
import type { NetflixInbox } from '@/platform/server/netflix-imap';
import type { BotStore } from '@/modules/messaging/bot-store';
import type { BotEventsStore } from '@/modules/messaging/bot-events-store';
import type { BotWaitStore } from '@/modules/messaging/bot-wait-store';
import type { NetflixClaimStore } from '@/modules/messaging/netflix-claim-store';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { NewOutboundMessage, OutboundResult } from '@/modules/whatsapp/outbound-messages';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { PurchaseStep } from '@/modules/bot-config';
import type { BotDefinition, BotEventType, PurchaseBlockType } from '@/types/bot';

const log = createLogger('WhatsAppBot');

/** Una venta activa del cliente a la que se le puede reenviar su acceso (sin ningún dato secreto). */
export type AccessSale = { saleId: string; service: string; profile: string };
/** Los datos de acceso armados con su plantilla independiente; `stored` es lo único que guarda el chat (sin contraseña ni PIN). */
export type AccessText = { text: string; stored: string; withheld: boolean };
// Los datos de acceso de un cliente: solo de su número y de sus ventas activas. Ausente si el bot no puede leerlos.
export type AccessData = {
  eligible: (waId: string) => Promise<AccessSale[]>;
  compose: (waId: string, saleId: string) => Promise<AccessText | null>;
};

export type BotDeps = {
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
  resolveOwnedSale?: (waId: string, saleId: string) => Promise<string | null>;
  // Datos del pedido abierto del cliente para los textos de los nodos (lista blanca de bot-config); ausente si no hay pedido.
  orderValues?: () => Promise<Record<string, string>>;
  // Si algun plan del catalogo tiene perfiles libres; lo usa la condicion «con o sin cupo».
  catalogHasStock?: () => Promise<boolean>;
  accessData?: AccessData;
  // Las esperas de respuesta escrita (textos que esperan al cliente); ausente si el bot no las puede guardar.
  waits?: BotWaitStore;
  createReport?: (message: InboundMessage) => Promise<void>;
};

export type BotResult = 'ignored' | 'menu' | 'node' | 'handoff' | 'option_unavailable' | 'limited' | 'none' | 'no_profile'
  | 'unavailable' | 'retry' | 'not_found' | 'already_sent' | 'list' | 'code' | 'link' | 'send_failed' | 'access';

/** The journey reached a purchase node: the purchase flow answers this same message (and may hand the turn back). */
type BotDelegation = { delegate: PurchaseStep; prefix?: string };
export type BotOutcome = BotResult | BotDelegation;
/** The purchase flow gives the turn back: its notice travels with the journey node in one message. */
export type BotHandBack = { text: string; prefixed: boolean; block: PurchaseBlockType | null };

// What one inbound message needs to be answered: who wrote, when, and the published bot.
// `hasServices`: an active sale of any service; `purchaseServed`: the purchase flow answers this number.
export type BotRun = {
  deps: BotDeps; message: InboundMessage; now: Date; clienteId: string | null; hasServices: boolean; purchaseServed: boolean;
};

export function botReplyKey(waMessageId: string, part?: string): string {
  const hex = createHash('sha256').update(`bot-reply:${waMessageId}${part ? `:${part}` : ''}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// Stable keys per inbound message and segment prevent duplicate delivery during retries.
export function reply(
  deps: BotDeps, message: InboundMessage, payload: OutboundPayload, storedTextBody?: string, part?: string,
): Promise<OutboundResult> {
  return deps.send({
    idempotencyKey: botReplyKey(message.waMessageId, part), toWaId: message.fromWaId, payload, sentBy: null,
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
