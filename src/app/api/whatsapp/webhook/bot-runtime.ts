import { getNetflixMailConfig } from '@/platform/config/netflix-server';
import { createLogger } from '@/platform/observability/logger';
import { openNetflixInbox } from '@/platform/server/netflix-imap';
import { fetchTravelPageHtml } from '@/platform/server/netflix-travel-page';
import { handleBotMessage } from '@/application/use-cases/whatsapp-bot-use-case';
import type { BotDeps, BotResult } from '@/application/use-cases/bot-reply';
import { createBotConfigStore } from '@/modules/messaging/bot-config-store';
import { createBotEventsStore, type BotEventsStore } from '@/modules/messaging/bot-events-store';
import { createBotStore } from '@/modules/messaging/bot-store';
import { createNetflixClaimStore } from '@/modules/messaging/netflix-claim-store';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import { resolveAccessSale } from '@/modules/whatsapp/order-delivery-store';
import type { BotDefinition } from '@/types/bot';

const logger = createLogger('WhatsAppBotRuntime');

// Composition root of the bot for one webhook delivery: the published configuration is read
// once and the bot stays silent unless it is switched on and valid.
export function createBotRuntime(requestId: string) {
  let events: BotEventsStore | undefined;
  // Created on first use: a missing database setting must not break the delivery.
  const eventsStore: BotEventsStore = { record: (event) => (events ??= createBotEventsStore()).record(event) };
  const definitions = new Map<number | null, Promise<BotDefinition | null>>();
  const versions = new Map<number | null, number>();
  let loadedVersion: number | null = null;

  // The event is for the audit trail only: failing to write it changes nothing else.
  async function recordError(message: InboundMessage, detail: Record<string, string>): Promise<void> {
    try {
      await eventsStore.record({ waId: message.fromWaId, type: 'error', detail });
    } catch {
      logger.warn('Bot event could not be recorded', { requestId });
    }
  }

  async function loadDefinition(message: InboundMessage, pinnedVersion: number | null): Promise<BotDefinition | null> {
    try {
      const snapshot = await createBotConfigStore().load(pinnedVersion);
      if (snapshot.ready) { versions.set(pinnedVersion, snapshot.version); return snapshot.definition; }
      // A switched-off bot is a decision, not a fault.
      if (snapshot.reason !== 'disabled') {
        logger.warn('WhatsApp bot configuration is not usable', { requestId, reason: snapshot.reason });
        await recordError(message, { motivo: snapshot.reason });
      }
    } catch {
      logger.warn('WhatsApp bot configuration could not be loaded', { requestId });
      await recordError(message, { motivo: 'config_no_disponible' });
    }
    return null;
  }

  return {
    async configuration(message: InboundMessage, pinnedVersion: number | null = null) {
      if (!definitions.has(pinnedVersion)) definitions.set(pinnedVersion, loadDefinition(message, pinnedVersion));
      const published = await definitions.get(pinnedVersion) ?? null;
      loadedVersion = versions.get(pinnedVersion) ?? null;
      return published;
    },
    // 'off' when the bot is not answering at all.
    get version() { return loadedVersion; },
    async handle(message: InboundMessage, send: BotDeps['send'], pinnedVersion: number | null = null): Promise<BotResult | 'off'> {
      if (!definitions.has(pinnedVersion)) definitions.set(pinnedVersion, loadDefinition(message, pinnedVersion));
      const published = await definitions.get(pinnedVersion);
      loadedVersion = versions.get(pinnedVersion) ?? null;
      if (!published) return 'off';
      try {
        return await handleBotMessage(message, {
          store: createBotStore(), claims: createNetflixClaimStore(), events: eventsStore, definition: published,
          fetchTravelPage: fetchTravelPageHtml,
          openInbox: async () => {
            const mailbox = getNetflixMailConfig();
            return mailbox ? openNetflixInbox(mailbox.user, mailbox.password) : null;
          },
          send,
          resolveOwnedSale: resolveAccessSale,
        });
      } catch (error) {
        await recordError(message, { motivo: 'respuesta_fallida' });
        throw error;
      }
    },
  };
}
