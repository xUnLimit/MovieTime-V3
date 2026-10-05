import { buildNodeMessage, purchaseStepOf, resolveOption, shouldOfferMenu, type PurchaseStep } from '@/modules/bot-config';
import type { BotService } from '@/modules/messaging/bot-store';
import { readBotAction, type BotAction, type LegacyTarget } from '@/modules/whatsapp/bot-menu';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { BotActionKey, BotNode, PurchaseBlockType } from '@/types/bot';
import { renderBotMessage, sayMessage } from './bot-messages';
import { followConditions, nodeWithValues } from './bot-node-runtime';
import { reply, trackEvent, type BotDeps, type BotHandBack, type BotOutcome, type BotRun } from './bot-reply';
import { requestNetflixCode } from './netflix-code-flow';

const MINUTE_MS = 60_000;
// The purchase flow answers these numbers (it needs a Panama WhatsApp id); the same population receives the journey.
const PURCHASE_SERVED = /^507\d{8}$/;
const LEGACY_ACTIONS: Record<Exclude<LegacyTarget, 'entry'>, BotActionKey> = {
  login: 'netflix_login_code', travel: 'netflix_travel_code', handoff: 'handoff',
};

// The built-in actions an action node can connect: the code says how, the administrator says where.
async function runAction(run: BotRun, action: BotActionKey | undefined, services: BotService[], prefix?: string): Promise<BotOutcome | null> {
  if (action === 'netflix_login_code') return requestNetflixCode(run, services, { type: 'login', serviceId: null });
  if (action === 'netflix_travel_code') return requestNetflixCode(run, services, { type: 'travel', serviceId: null });
  if (action === 'handoff') {
    await sayMessage(run, 'handoff_ack', undefined, prefix);
    await trackEvent(run, 'handoff');
    return 'handoff';
  }
  return null;
}

type Delivery = { result: BotOutcome; shown: BotNode | null };
// `prefix`: a notice that travels with the node in one reply (each inbound message gets one). `fromEntry` marks the
// start of the flow, where a badly wired condition output falls back to the other one. `handedBack`: the purchase flow
// already answered this message and gave the turn back; a purchase node then only says that text, never delegates again.
type Show = { prefix?: string; fromEntry?: boolean; handedBack?: string };

const entryOf = (run: BotRun): BotNode | undefined => run.deps.definition.nodes.find((node) => node.id === run.deps.definition.entryNodeId);

// A purchase node is never sent as text: the purchase flow answers it with real data. Numbers it cannot serve get the
// journey's "option no longer available" notice and, unless the entry is itself a purchase node, the entry.
async function purchaseNode(run: BotRun, services: BotService[], step: PurchaseStep, show: Show): Promise<BotOutcome> {
  if (show.handedBack !== undefined) {
    await reply(run.deps, run.message, { kind: 'text', text: show.handedBack });
    return 'node';
  }
  if (run.purchaseServed) return { delegate: step, ...(show.prefix ? { prefix: show.prefix } : {}) };
  await trackEvent(run, 'option_unavailable', { detail: { motivo: 'compras_no_disponibles' } });
  const notice = renderBotMessage(run.deps.definition, 'option_unavailable');
  const entry = entryOf(run);
  if (!entry || entry.kind === 'action') {
    await sayMessage(run, 'option_unavailable');
    return 'option_unavailable';
  }
  const { result } = await showNode(run, entry, services, { prefix: notice, fromEntry: true, handedBack: notice });
  return result === 'node' ? 'option_unavailable' : result;
}

// Sends a node; an action node runs its action instead. Conditions are resolved on the server first: `shown` is the node
// the customer really received (never a condition).
async function showNode(run: BotRun, start: BotNode, services: BotService[], show: Show = {}): Promise<Delivery> {
  const node = await followConditions(run, start, show.fromEntry);
  if (!node) return { result: 'ignored', shown: null };
  const step = purchaseStepOf(node);
  if (step) return { result: await purchaseNode(run, services, step, show), shown: node };
  if (node.kind === 'action') return { result: (await runAction(run, node.action, services, show.prefix)) ?? 'ignored', shown: node };
  const rendered = await nodeWithValues(run, node);
  const body = show.prefix ? { ...rendered, body: `${show.prefix}\n\n${rendered.body}` } : rendered;
  await reply(run.deps, run.message, buildNodeMessage(body));
  return { result: 'node', shown: node };
}

async function deliverNode(run: BotRun, start: BotNode, services: BotService[], show: Show = {}): Promise<BotOutcome> {
  return (await showNode(run, start, services, show)).result;
}

async function optionUnavailable(run: BotRun, action: Extract<BotAction, { kind: 'option' }>, services: BotService[]): Promise<BotOutcome> {
  await trackEvent(run, 'option_unavailable', { nodeId: action.nodeId, optionId: action.optionId });
  const notice = renderBotMessage(run.deps.definition, 'option_unavailable');
  const entry = entryOf(run);
  // An entry that is a purchase node still gets the notice: the purchase flow answers with it in front.
  if (!entry || (entry.kind === 'action' && !purchaseStepOf(entry))) {
    await sayMessage(run, 'option_unavailable');
    return 'option_unavailable';
  }
  const result = await deliverNode(run, entry, services, { prefix: notice, fromEntry: true });
  return typeof result === 'string' ? 'option_unavailable' : result;
}

async function handleOption(run: BotRun, action: Extract<BotAction, { kind: 'option' }>, services: BotService[]): Promise<BotOutcome> {
  const resolved = resolveOption(run.deps.definition, action.nodeId, action.optionId);
  if (!resolved) return optionUnavailable(run, action, services);
  const { node, option, target } = resolved;
  await trackEvent(run, 'option_selected', { nodeId: node.id, optionId: option.id, detail: { destino: target.id } });
  return deliverNode(run, target, services);
}

async function handleLegacy(run: BotRun, target: LegacyTarget, services: BotService[]): Promise<BotOutcome> {
  await trackEvent(run, 'option_selected', { detail: { destino: target, compatibilidad: true } });
  if (target === 'entry') {
    const entry = entryOf(run);
    return entry ? deliverNode(run, entry, services, { fromEntry: true }) : 'ignored';
  }
  return (await runAction(run, LEGACY_ACTIONS[target], services)) ?? 'ignored';
}

async function handleAction(run: BotRun, action: BotAction, services: BotService[]): Promise<BotOutcome> {
  if (action.kind === 'option') return handleOption(run, action, services);
  if (action.kind === 'legacy') return handleLegacy(run, action.target, services);
  if (action.kind === 'sale') {
    const serviceId = await run.deps.resolveOwnedSale?.(run.message.fromWaId, action.saleId);
    if (!serviceId || !services.some((service) => service.serviceId === serviceId)) return 'ignored';
    return requestNetflixCode(run, services, { type: action.type, serviceId });
  }
  await trackEvent(run, 'option_selected', { detail: { destino: 'elegir_cuenta', tipo: action.type } });
  return requestNetflixCode(run, services, { type: action.type, serviceId: action.serviceId });
}

async function offerMenu(run: BotRun, text: string | null, services: BotService[]): Promise<BotOutcome> {
  const { deps, message, now } = run;
  const { definition } = deps;
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
  const entry = entryOf(run);
  if (!entry) return 'ignored';
  const { result, shown } = await showNode(run, entry, services, { fromEntry: true });
  if (result === 'node' && shown) {
    await trackEvent(run, 'menu_shown', { nodeId: shown.id });
    return 'menu';
  }
  return result;
}

// Where the customer lands when the purchase flow gives the turn back: the node that "Cancelar" of the block they were
// in leads to, when the journey has that block and the node exists; the start of the journey otherwise.
function handBackTarget(run: BotRun, block: PurchaseBlockType | null): { node: BotNode | undefined; fromEntry: boolean } {
  const { definition } = run.deps;
  const cancel = block ? definition.nodes.find((node) => node.block?.type === block)?.options.find((option) => option.id === 'cancel') : undefined;
  const target = cancel ? definition.nodes.find((node) => node.id === cancel.next) : undefined;
  return target ? { node: target, fromEntry: target.id === definition.entryNodeId } : { node: entryOf(run), fromEntry: true };
}

async function handBackToJourney(run: BotRun, handBack: BotHandBack, services: BotService[]): Promise<BotOutcome> {
  const { node, fromEntry } = handBackTarget(run, handBack.block);
  const result = node ? await deliverNode(run, node, services, { prefix: handBack.prefixed ? handBack.text : undefined, fromEntry, handedBack: handBack.text }) : 'ignored';
  if (result !== 'ignored') return result;
  // The customer must always get the purchase flow's answer, even if the journey has nothing to show.
  await reply(run.deps, run.message, { kind: 'text', text: handBack.text });
  return 'node';
}

/**
 * Answers a menu tap and, when it is appropriate, offers the menu. Known customers (whatever their services) and Panama
 * numbers the purchase flow already serves get the journey; other numbers never get an automatic reply. `input.handBack`:
 * the purchase flow already answered this message and gives the turn back to the journey.
 */
export async function handleBotMessage(message: InboundMessage, deps: BotDeps, input: { handBack?: BotHandBack } = {}): Promise<BotOutcome> {
  const action = readBotAction(message);
  const text = message.messageType === 'text' ? message.textBody : null;
  if (!input.handBack && !action && text === null) return 'ignored';
  const { known, clienteId, services, hasServices } = await deps.store.customerServices(message.fromWaId);
  const purchaseServed = PURCHASE_SERVED.test(message.fromWaId);
  if (!known && !purchaseServed) return 'ignored';
  const run: BotRun = { deps, message, now: deps.now?.() ?? new Date(), clienteId, hasServices, purchaseServed };
  if (input.handBack) return handBackToJourney(run, input.handBack, services);
  return action ? handleAction(run, action, services) : offerMenu(run, text, services);
}
