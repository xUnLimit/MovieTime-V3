import { advance, type ConversationInput } from '@/modules/bot-config/conversation-engine';
import { normalizeText, parseOptionReplyId, shouldOfferMenu } from '@/modules/bot-config';
import { decodeEntityReplyId } from '@/modules/bot-config/entity-reply-codec';
import { readBotAction } from '@/modules/whatsapp/bot-menu';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import { conversationStateSchema, type ConversationState } from '@/platform/validation/conversation-state';
import { z } from '@/platform/validation/zod';
import { reply, trackEvent } from '../bot-reply';
import { ACTION_HANDLERS } from './actions';
import { catalogRoute, handleCatalogRoute } from './catalog-flow';
import type { ActionContext, ActionResult, V2Deps } from './contracts';

function replyId(message: InboundMessage): string | null {
  const p = message.payload;
  if (message.messageType === 'button' && p && typeof p === 'object' && !Array.isArray(p) &&
    p.type === 'template_button' && typeof p.payload === 'string') return p.payload;
  return message.messageType === 'interactive' && p && typeof p === 'object' && !Array.isArray(p) &&
    (p.type === 'button_reply' || p.type === 'list_reply') && typeof p.id === 'string' ? p.id : null;
}
function answerEvent(message: InboundMessage, state: ConversationState): ConversationInput['event'] | null {
  if (!state.awaiting) return null;
  const text = message.messageType === 'text' ? message.textBody : null;
  // Fixed policy: do not persist unsolicited access/payment material, even in an input node.
  if (text && /(https?:\/\/|bearer\s|password|contras[eñ]na|contraseña|token|clave|c[oó]digo|\d{6,}|[A-Za-z0-9_-]{24,})/i.test(text)) return null;
  if (state.awaiting.tipo === 'image') return message.messageType === 'image' && message.mediaId
    ? { kind: 'answer', tipo: 'image', value: message.mediaId } : null;
  if (!text || text.length > 512) return null;
  if (state.awaiting.tipo === 'number') {
    const parts = text.split('.');
    if (parts.length > 2 || !/^-?[0-9]+$/.test(parts[0]) || (parts.length === 2 && !/^[0-9]+$/.test(parts[1]))) return null;
    return { kind: 'answer', tipo: 'number', value: Number(text) };
  }
  return { kind: 'answer', tipo: 'text', value: text };
}
function leadTarget(ctx: ActionContext, nodeId: string, visited = new Set<string>()): boolean {
  if (visited.has(nodeId)) return false;
  visited.add(nodeId);
  const node = ctx.run.deps.definition.nodes.find(candidate => candidate.id === nodeId);
  if (!node || node.kind === 'input') return false;
  if (node.kind === 'action') return node.action === 'show_catalog' || node.action === 'register_interest';
  if (node.kind === 'condition' && node.condition) return [node.condition.yes, node.condition.no].some(next => leadTarget(ctx, next, new Set(visited)));
  return node.options.some(option => leadTarget(ctx, option.next, new Set(visited)));
}
async function plan(ctx: ActionContext, message: InboundMessage, event: ConversationInput['event'], now: Date): Promise<ActionResult | null> {
  const { deps } = ctx.run;
  const id = replyId(message);
  const route = id ? catalogRoute(id) : null;
  if (route) return handleCatalogRoute(ctx, route);
  const entity = id ? decodeEntityReplyId(id) : null;
  const requested = entity?.kind === 'CODE' ? entity.entityId :
    ctx.state.awaiting && Date.parse(ctx.state.awaiting.expiresAt) > now.getTime() &&
    typeof ctx.state.variables.solicitud_venta === 'string' && ['ya', 'el codigo', 'listo'].includes(normalizeText(message.textBody ?? ''))
      ? ctx.state.variables.solicitud_venta : null;
  if (entity && entity.kind !== 'CODE') return null;
  if (requested) return ACTION_HANDLERS.send_code?.({ ...ctx, params: { venta_id: requested } }) ?? null;
  const legacy = readBotAction(message);
  if (id && !legacy) return null;
  if (legacy?.kind === 'account') {
    if (ctx.contact.estado !== 'cliente') return null;
    const customer = await deps.store.customerServices(ctx.contact.waId);
    if (!customer.known || customer.clienteId !== ctx.contact.terceroId) return null;
    const { requestNetflixCode } = await import('../netflix-code-flow');
    return { state: ctx.state, execute: async () => {
      const result = await requestNetflixCode(ctx.run, customer.services, legacy);
      if (result === 'send_failed') throw new Error('Bot code delivery failed');
    } };
  }
  if (legacy?.kind === 'legacy' && legacy.target !== 'entry') {
    const key = legacy.target === 'login' ? 'netflix_login_code' : legacy.target === 'travel' ? 'netflix_travel_code' : 'handoff';
    return ctx.contact.estado === 'cliente' ? ACTION_HANDLERS[key]?.(ctx) ?? null : null;
  }
  // Leads use the published graph, with fixed capability filtering rather than an access menu.
  const lead = ctx.contact.estado === 'lead';
  const context = lead ? { activeCategories: [], pendingOrder: false } : await deps.identity.context(ctx.contact.waId);
  const transition = advance(deps.definition, ctx.state, {
    flowVersion: deps.version, now: now.toISOString(), context: { ...context, contact: lead ? 'lead' : 'cliente' }, event,
  });
  if (transition.status === 'expired') return { state: transition.state };
  if (['blocked', 'invalid', 'human'].includes(transition.status)) return null;
  const effect = transition.effects[0];
  if (!effect) return { state: transition.state };
  if (effect.kind === 'message') {
    if (!lead) return { state: transition.state, message: effect.message };
    const node = deps.definition.nodes.find(candidate => candidate.id === transition.state.nodeId);
    if (!node || node.kind === 'input') return null;
    const allowed = (reply: { id: string }) => {
      const option = parseOptionReplyId(reply.id);
      const target = node.options.find(candidate => candidate.id === option?.optionId)?.next;
      return target ? leadTarget(ctx, target) : false;
    };
    if (effect.message.kind === 'buttons') {
      const buttons = effect.message.buttons.filter(allowed);
      return buttons.length ? { state: transition.state, message: { ...effect.message, buttons } } : null;
    }
    if (effect.message.kind === 'list') {
      const rows = effect.message.rows.filter(allowed);
      return rows.length ? { state: transition.state, message: { ...effect.message, rows } } : null;
    }
    return null;
  }
  if (lead && effect.key !== 'show_catalog' && effect.key !== 'register_interest') return null;
  return ACTION_HANDLERS[effect.key]?.({ ...ctx, state: transition.state, params: effect.params }) ?? null;
}

/** CAS reserves each turn before effects. Pending turns retain their source state for safe replay.
 * Outbound delivery and interest registration independently deduplicate their effects.
 */
export async function handleV2Message(message: InboundMessage, deps: V2Deps): Promise<'ignored' | 'node' | 'handoff'> {
  const now = deps.now?.() ?? new Date();
  const snapshot = await deps.states.load(message.fromWaId);
  if (snapshot?.state.owner === 'humano') return 'ignored'; // even expired human ownership remains authoritative
  const contact = await deps.contacts.upsert(message.fromWaId, message.contactName);
  if (contact.estado === 'bloqueado' || (contact.estado === 'cliente' && !contact.terceroId)) return 'ignored';
  const run = { deps, message, now, clienteId: contact.terceroId };
  let old = snapshot?.state;
  // Takeover/hand-back increases revision and clears awaiting. Abandon that interrupted
  // turn rather than letting its pending marker prevent the administrator's hand-back.
  if (old?.variables.runtime_pending === true && typeof old.variables.runtime_revision === 'number' &&
    old.variables.runtime_revision !== snapshot?.revision) old = {
      ...old, awaiting: null, variables: { ...old.variables, runtime_pending: false, runtime_last: null },
    };
  if (old?.variables.runtime_last !== message.waMessageId && await deps.replied(message.waMessageId)) return 'ignored';
  if (old?.variables.runtime_last === message.waMessageId && old.variables.runtime_pending === false) return 'ignored';
  if (old?.variables.runtime_pending === true && old.variables.runtime_last !== message.waMessageId) throw new Error('Conversation turn pending');
  const replay = old?.variables.runtime_pending === true;
  const fresh = !old || old.flowVersion !== deps.version || Date.parse(snapshot?.expiresAt ?? '') <= now.getTime();
  if (replay && fresh) throw new Error('Pending conversation version changed');
  let state: ConversationState = fresh ? {
    flowVersion: deps.version, nodeId: deps.definition.entryNodeId, variables: {}, awaiting: null, owner: 'bot',
  } : old!;
  let event: ConversationInput['event'] = { kind: 'enter' };
  const action = readBotAction(message);
  const id = replyId(message);
  if (action?.kind === 'option') {
    if (action.nodeId !== state.nodeId) return 'ignored';
    event = { kind: 'option', optionId: action.optionId };
  } else if (state.awaiting && !state.variables.solicitud_venta) {
    const answer = answerEvent(message, state);
    if (!answer) return 'ignored';
    event = answer;
  } else if (!id && !state.variables.solicitud_venta && !replay) {
    if (message.messageType !== 'text') return 'ignored';
    const lastActivityAt = await deps.store.lastActivityAt(message.fromWaId, message.waMessageId);
    if (!shouldOfferMenu({ text: message.textBody, lastActivityAt, operatorRepliedRecently: false,
      now, params: deps.definition.params, keywords: deps.definition.keywords })) return 'ignored';
    state = { ...state, nodeId: deps.definition.entryNodeId, awaiting: null };
  }
  const turnNow = replay && typeof state.variables.runtime_at === 'string' ? new Date(state.variables.runtime_at) : now;
  const ctx: ActionContext = { run, state, contact, params: {} };
  const result = await plan(ctx, message, event, turnNow);
  if (!result) {
    if (replay) {
      const abandoned = { ...state, variables: { ...state.variables, runtime_pending: false } };
      if (!await deps.states.compareAndSet(message.fromWaId, snapshot?.revision ?? null, abandoned,
        new Date(now.getTime() + 29 * 86400_000).toISOString())) throw new Error('Conversation conflict');
    }
    await trackEvent(run, 'error', { detail: { motivo: 'accion_no_disponible_o_no_autorizada' } });
    return 'ignored';
  }
  const ttl = new Date(now.getTime() + 29 * 86400_000).toISOString();
  const pending: ConversationState = { ...state, variables: { ...state.variables,
    runtime_last: message.waMessageId, runtime_pending: true, runtime_at: turnNow.toISOString(),
    runtime_revision: replay ? state.variables.runtime_revision ?? snapshot?.revision ?? 1 : (snapshot?.revision ?? 0) + 1 } };
  let revision = snapshot?.revision ?? null;
  if (!replay) {
    if (!await deps.states.compareAndSet(message.fromWaId, revision, pending, ttl)) throw new Error('Conversation conflict');
    revision = (revision ?? 0) + 1;
  }
  // Re-check ownership after preparation; admin takeover increments the same revision.
  const current = await deps.states.load(message.fromWaId);
  if (current?.state.owner === 'humano') return 'ignored';
  if (current?.revision !== revision) throw new Error('Conversation conflict');
  let done = { ...result.state, variables: { ...result.state.variables,
    runtime_last: message.waMessageId, runtime_pending: false, runtime_at: turnNow.toISOString() } };
  conversationStateSchema.parse(done); // validate the final state before any effect
  // Handoff must establish silence before acknowledging it.
  if (done.owner === 'humano' && !await deps.states.compareAndSet(message.fromWaId, revision, done, ttl)) throw new Error('Conversation conflict');
  const executedState = await result.execute?.();
  if (executedState) done = { ...executedState, variables: { ...executedState.variables,
    runtime_last: message.waMessageId, runtime_pending: false, runtime_at: turnNow.toISOString() } };
  if (result.message) {
    const sent = await reply(deps, message, result.message);
    if (sent.sendStatus !== 'accepted') throw new Error('Bot reply not accepted');
  }
  if (done.owner !== 'humano' && !await deps.states.compareAndSet(message.fromWaId, revision, done, ttl)) throw new Error('Conversation conflict');
  if (id || event.kind === 'option') await trackEvent(run, 'option_selected', {
    nodeId: state.nodeId, ...(event.kind === 'option' ? { optionId: event.optionId } : {}),
  });
  else if (result.message) await trackEvent(run, 'menu_shown', { nodeId: done.nodeId });
  if (result.event) await trackEvent(run, result.event, { nodeId: done.nodeId });
  return done.owner === 'humano' ? 'handoff' : 'node';
}

/** Welcome messages use the same validated entity codec; only the sale id enters state. */
export async function awaitCodeRequest(waId: string, ventaId: string, deps: Pick<V2Deps, 'states' | 'definition' | 'version'>, now: Date): Promise<void> {
  z.string().uuid().parse(ventaId);
  const snapshot = await deps.states.load(waId);
  if (snapshot?.state.owner === 'humano' || snapshot?.state.variables.runtime_pending === true) return;
  const nodeId = deps.definition.entryNodeId;
  const expiresAt = new Date(now.getTime() + 86400_000).toISOString();
  const state: ConversationState = { flowVersion: deps.version, nodeId,
    owner: 'bot', variables: { ...snapshot?.state.variables, solicitud_venta: ventaId },
    awaiting: { tipo: 'text', ref: nodeId, expiresAt } };
  if (!await deps.states.compareAndSet(waId, snapshot?.revision ?? null, state, expiresAt)) throw new Error('Conversation conflict');
}
