import { buildNodeMessage, resolveOption, shouldOfferMenu } from '@/modules/bot-config';
import type { BotService } from '@/modules/messaging/bot-store';
import { readBotAction, type BotAction, type LegacyTarget } from '@/modules/whatsapp/bot-menu';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { BotActionKey, BotNode } from '@/types/bot';
import { renderBotMessage, sayMessage } from './bot-messages';
import { reply, trackEvent, type BotDeps, type BotResult, type BotRun } from './bot-reply';
import { requestNetflixCode } from './netflix-code-flow';

const MINUTE_MS = 60_000;
const LEGACY_ACTIONS: Record<Exclude<LegacyTarget, 'entry'>, BotActionKey> = {
  login: 'netflix_login_code', travel: 'netflix_travel_code', handoff: 'handoff',
};

// The built-in actions an action node can connect: the code says how, the administrator says where.
async function runAction(run: BotRun, action: BotActionKey | undefined, services: BotService[]): Promise<BotResult | null> {
  if (action === 'netflix_login_code') return requestNetflixCode(run, services, { type: 'login', serviceId: null });
  if (action === 'netflix_travel_code') return requestNetflixCode(run, services, { type: 'travel', serviceId: null });
  if (action === 'handoff') {
    await sayMessage(run, 'handoff_ack');
    await trackEvent(run, 'handoff');
    return 'handoff';
  }
  return null;
}

// Sends a node; an action node runs its action instead. The prefix lets the "option no
// longer exists" notice and the menu travel in one reply (each inbound message gets one).
async function deliverNode(run: BotRun, node: BotNode, services: BotService[], prefix?: string): Promise<BotResult> {
  if (node.kind === 'action') return (await runAction(run, node.action, services)) ?? 'ignored';
  const shown = prefix ? { ...node, body: `${prefix}\n\n${node.body}` } : node;
  await reply(run.deps, run.message, buildNodeMessage(shown));
  return 'node';
}

async function optionUnavailable(run: BotRun, action: Extract<BotAction, { kind: 'option' }>, services: BotService[]): Promise<BotResult> {
  const { definition } = run.deps;
  await trackEvent(run, 'option_unavailable', { nodeId: action.nodeId, optionId: action.optionId });
  const notice = renderBotMessage(definition, 'option_unavailable');
  const entry = definition.nodes.find((node) => node.id === definition.entryNodeId);
  if (!entry || entry.kind === 'action') {
    await sayMessage(run, 'option_unavailable');
    return 'option_unavailable';
  }
  await deliverNode(run, entry, services, notice);
  return 'option_unavailable';
}

async function handleOption(run: BotRun, action: Extract<BotAction, { kind: 'option' }>, services: BotService[]): Promise<BotResult> {
  const resolved = resolveOption(run.deps.definition, action.nodeId, action.optionId);
  if (!resolved) return optionUnavailable(run, action, services);
  const { node, option, target } = resolved;
  await trackEvent(run, 'option_selected', { nodeId: node.id, optionId: option.id, detail: { destino: target.id } });
  return deliverNode(run, target, services);
}

async function handleLegacy(run: BotRun, target: LegacyTarget, services: BotService[]): Promise<BotResult> {
  await trackEvent(run, 'option_selected', { detail: { destino: target, compatibilidad: true } });
  if (target === 'entry') {
    const { definition } = run.deps;
    const entry = definition.nodes.find((node) => node.id === definition.entryNodeId);
    return entry ? deliverNode(run, entry, services) : 'ignored';
  }
  return (await runAction(run, LEGACY_ACTIONS[target], services)) ?? 'ignored';
}

async function handleAction(run: BotRun, action: BotAction, services: BotService[]): Promise<BotResult> {
  if (action.kind === 'option') return handleOption(run, action, services);
  if (action.kind === 'legacy') return handleLegacy(run, action.target, services);
  await trackEvent(run, 'option_selected', { detail: { destino: 'elegir_cuenta', tipo: action.type } });
  return requestNetflixCode(run, services, { type: action.type, serviceId: action.serviceId });
}

async function offerMenu(run: BotRun, text: string | null, services: BotService[]): Promise<BotResult> {
  const { deps, message, now } = run;
  const { definition } = deps;
  // Without a Netflix account the only menu option left would be support.
  if (services.length === 0) return 'ignored';
  const quietMs = definition.params.operatorQuietMinutes * MINUTE_MS;
  const [lastActivityAt, operatorRepliedRecently] = await Promise.all([
    deps.store.lastActivityAt(message.fromWaId, message.waMessageId),
    quietMs > 0
      ? deps.store.operatorRepliedSince(message.fromWaId, new Date(now.getTime() - quietMs).toISOString())
      : Promise.resolve(false),
  ]);
  if (!shouldOfferMenu({
    text, lastActivityAt, operatorRepliedRecently, now, params: definition.params, keywords: definition.keywords,
  })) return 'ignored';
  const entry = definition.nodes.find((node) => node.id === definition.entryNodeId);
  if (!entry) return 'ignored';
  const result = await deliverNode(run, entry, services);
  if (result === 'node') {
    await trackEvent(run, 'menu_shown', { nodeId: entry.id });
    return 'menu';
  }
  return result;
}

// Answers a registered customer's menu taps and, when it is appropriate, offers the
// menu. Unknown numbers never get an automatic reply.
export async function handleBotMessage(message: InboundMessage, deps: BotDeps): Promise<BotResult> {
  if (await deps.conversationOwner?.(message.fromWaId) === 'humano') return 'ignored';
  const action = readBotAction(message);
  const text = message.messageType === 'text' ? message.textBody : null;
  if (!action && text === null) return 'ignored';
  const { known, clienteId, services } = await deps.store.customerServices(message.fromWaId);
  if (!known) return 'ignored';
  const run: BotRun = { deps, message, now: deps.now?.() ?? new Date(), clienteId };
  return action ? handleAction(run, action, services) : offerMenu(run, text, services);
}
