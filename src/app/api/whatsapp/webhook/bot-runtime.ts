import { getNetflixMailConfig } from '@/platform/config/netflix-server';
import { createLogger } from '@/platform/observability/logger';
import { openNetflixInbox } from '@/platform/server/netflix-imap';
import { fetchTravelPageHtml } from '@/platform/server/netflix-travel-page';
import { orderTemplateValues } from '@/application/use-cases/bot-order-values';
import { getPedidoServerUseCase, listCatalogoServerUseCase } from '@/application/use-cases/pedidos-server-use-cases';
import { handleBotMessage } from '@/application/use-cases/whatsapp-bot-use-case';
import type { BotDeps, BotHandBack, BotOutcome } from '@/application/use-cases/bot-reply';
import { resolveOption } from '@/modules/bot-config';
import { createBotConfigStore } from '@/modules/messaging/bot-config-store';
import { createBotEventsStore, type BotEventsStore } from '@/modules/messaging/bot-events-store';
import { createBotStore } from '@/modules/messaging/bot-store';
import { createNetflixClaimStore } from '@/modules/messaging/netflix-claim-store';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import { readBotAction } from '@/modules/whatsapp/bot-menu';
import { resolveAccessSale } from '@/modules/whatsapp/order-delivery-store';
import type { BotDefinition } from '@/types/bot';

const logger = createLogger('WhatsAppBotRuntime');

// Composition root of the bot for one webhook delivery. The latest published configuration is read once and the bot
// stays silent unless it is switched on and valid. A conversation is pinned to the version it started with, but only to
// keep old buttons working: everything else is answered with the latest version.
export function createBotRuntime(requestId: string) {
  let events: BotEventsStore | undefined;
  // Created on first use: a missing database setting must not break the delivery.
  const eventsStore: BotEventsStore = { record: (event) => (events ??= createBotEventsStore()).record(event) };
  type Loaded = { definition: BotDefinition; version: number };
  const loads = new Map<number | null, Promise<Loaded | null>>();
  let latestVersion: number | null = null;

  // The event is for the audit trail only: failing to write it changes nothing else.
  async function recordError(message: InboundMessage, detail: Record<string, string>): Promise<void> {
    try {
      await eventsStore.record({ waId: message.fromWaId, type: 'error', detail });
    } catch {
      logger.warn('Bot event could not be recorded', { requestId });
    }
  }

  // `report`: an unusable configuration is worth an error event for the latest version, not for an old pinned one.
  async function loadDefinition(message: InboundMessage, version: number | null, report: boolean): Promise<Loaded | null> {
    try {
      const snapshot = await createBotConfigStore().load(version);
      if (snapshot.ready) return { definition: snapshot.definition, version: snapshot.version };
      // A switched-off bot is a decision, not a fault.
      if (snapshot.reason !== 'disabled') {
        logger.warn('WhatsApp bot configuration is not usable', { requestId, reason: snapshot.reason });
        if (report) await recordError(message, { motivo: snapshot.reason });
      }
    } catch {
      logger.warn('WhatsApp bot configuration could not be loaded', { requestId });
      if (report) await recordError(message, { motivo: 'config_no_disponible' });
    }
    return null;
  }

  function load(message: InboundMessage, version: number | null): Promise<Loaded | null> {
    let pending = loads.get(version);
    if (!pending) { pending = loadDefinition(message, version, version === null); loads.set(version, pending); }
    return pending;
  }

  return {
    // The latest published definition; null when the bot is switched off or not usable.
    async configuration(message: InboundMessage) {
      const latest = await load(message, null);
      latestVersion = latest?.version ?? null;
      return latest?.definition ?? null;
    },
    get version() { return latestVersion; },
    // A tap that no longer exists in the latest version still works when the version the conversation started with has it.
    async definitionFor(message: InboundMessage, pinnedVersion: number | null, latest: BotDefinition): Promise<BotDefinition> {
      const action = readBotAction(message);
      if (action?.kind !== 'option' || pinnedVersion === null || pinnedVersion === latestVersion) return latest;
      if (resolveOption(latest, action.nodeId, action.optionId)) return latest;
      const pinned = await load(message, pinnedVersion);
      return pinned && resolveOption(pinned.definition, action.nodeId, action.optionId) ? pinned.definition : latest;
    },
    async handle(definition: BotDefinition, message: InboundMessage, send: BotDeps['send'], orderId: string | null = null,
      input: { handBack?: BotHandBack } = {}): Promise<BotOutcome> {
      try {
        return await handleBotMessage(message, {
          store: createBotStore(), claims: createNetflixClaimStore(), events: eventsStore, definition,
          fetchTravelPage: fetchTravelPageHtml,
          openInbox: async () => {
            const mailbox = getNetflixMailConfig();
            return mailbox ? openNetflixInbox(mailbox.user, mailbox.password) : null;
          },
          send,
          resolveOwnedSale: resolveAccessSale,
          // Solo los datos de la lista blanca del pedido abierto de este mismo numero; el RPC valida la propiedad.
          ...(orderId ? { orderValues: async () => orderTemplateValues(await getPedidoServerUseCase(message.fromWaId, orderId)) } : {}),
          catalogHasStock: async () => (await listCatalogoServerUseCase()).some((plan) => plan.perfilesLibres > 0),
        }, input);
      } catch (error) {
        await recordError(message, { motivo: 'respuesta_fallida' });
        throw error;
      }
    },
  };
}
