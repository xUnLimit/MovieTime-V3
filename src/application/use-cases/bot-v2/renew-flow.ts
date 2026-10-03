import { renderTemplate } from '@/modules/bot-config';
import { applySelectionAction, selectedByCurrency, type RenewalSelection, type SelectionAction } from '@/modules/renewal-selection/selection';
import { serializeRenewalSelection } from '@/modules/renewal-selection/session';
import { renderRenewalSummary } from '@/modules/renewal-selection/summary';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import { DomainError } from '@/platform/errors/domain-errors';
import { conversationStateSchema, type ConversationState } from '@/platform/validation/conversation-state';
import { z } from '@/platform/validation/zod';
import { createRenewalOrder, declineSelected, startRenewalSelection, type RenewalSelectionDeps } from '../renewal-selection-use-cases';
import type { ActionContext, ActionHandler, ActionResult } from './contracts';
import type { RenewMessages } from './renew-messages';
import { renewId, type RenewRoute } from './renew-routes';

/** Everything the flow needs from the composition root. Identity and texts are injected, never read from stores. */
export type RenewDeps = {
  selection: RenewalSelectionDeps;
  messages(): Promise<RenewMessages>;
  /** `renovacion_ajustes.resumen_template` (must contain {{servicios}}, {{total}}, {{moneda}}). */
  template(): Promise<string>;
  /** Most recent accepted notice for the phone, used when the action has no explicit notice. */
  latestNoticeId(waId: string): Promise<string | null>;
};
const ROWS_PER_PAGE = 5;
const uuid = z.string().uuid();
const SESSION_KEYS = /^renewal_/;

const customerOnly = (ctx: ActionContext) => ctx.contact.estado === 'cliente' && Boolean(ctx.contact.terceroId);
/** Partial renewal off means "renew the whole notice": the use case's gate is lifted and everything is preselected. */
const wrap = (deps: RenewalSelectionDeps): RenewalSelectionDeps => ({
  ...deps, settings: async () => ({ ...await deps.settings(), renovacion_parcial_enabled: true }),
});
function cleared(state: ConversationState, patch: ConversationState['variables'] = {}): ConversationState {
  const variables = Object.fromEntries(Object.entries(state.variables).filter(([key]) => !SESSION_KEYS.test(key)));
  return { ...state, awaiting: null, variables: { ...variables, ...patch } };
}
const money = (groups: Map<string, { precio: number }[]>) => [...groups].sort(([a], [b]) => a.localeCompare(b))
  .map(([moneda, items]) => `${(items.reduce((s, i) => s + Math.round(i.precio * 100), 0) / 100).toFixed(2)} ${moneda}`).join(' + ');
const text = (payload: string): OutboundPayload => ({ kind: 'text', text: payload.slice(0, 1024) });

function render(ctx: ActionContext, selection: RenewalSelection, partial: boolean, texts: RenewMessages,
  template: string, page: number, prefix = ''): ActionResult | null {
  const eligible = selection.items.filter(item => !item.reason);
  if (!eligible.length) return { state: cleared(ctx.state), message: text(texts.none) };
  const pages = Math.ceil(eligible.length / ROWS_PER_PAGE);
  if (page < 0 || page >= pages) return null;
  let summary = renderTemplate(texts.compact, { seleccionados: String(selection.selected.length),
    total: money(selectedByCurrency(selection)) || '0.00' });
  if (selection.items.length <= 10) {
    const full = renderRenewalSummary(selection, 0, template).text;
    if (full.length <= 1000) summary = full;
  }
  const body = `${prefix}${partial ? '' : `${texts.partialOff}\n`}${summary}`.slice(0, 1024);
  const serialized = serializeRenewalSelection(selection, ctx.state.nodeId);
  const state: ConversationState = { ...ctx.state, awaiting: serialized.awaiting,
    variables: { ...cleared(ctx.state).variables, ...serialized.variables, renewal_page: page } };
  if (!conversationStateSchema.safeParse(state).success) return { state: cleared(ctx.state), message: text(texts.unavailable) };
  if (!partial) return { state, message: { kind: 'buttons', body, buttons: [
    { id: renewId('confirm'), title: texts.confirm }, { id: renewId('decline'), title: texts.decline },
  ] } };
  const mark = (id: string) => selection.selected.includes(id) ? '✓' : selection.declined.includes(id) ? '−' : '□';
  const rows: { id: string; title: string; description?: string }[] = eligible
    .slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE).map(item => ({
      id: renewId('toggle', item.ventaId), title: `${mark(item.ventaId)} ${item.servicio}`.slice(0, 24),
      description: `${item.perfil ? `${item.perfil} · ` : ''}${item.precio.toFixed(2)} ${item.moneda}`.slice(0, 72),
    }));
  rows.push({ id: renewId('all'), title: texts.selectAll }, { id: renewId('clear'), title: texts.clear },
    { id: renewId('decline'), title: texts.decline }, { id: renewId('confirm'), title: texts.confirm });
  if (page + 1 < pages) rows.push({ id: renewId('page', page + 1), title: texts.more });
  return { state, message: { kind: 'list', body, buttonLabel: texts.listButton, rows } };
}

export function createRenewalFlow(deps: RenewDeps, chain?: ActionHandler) {
  const wrapped = wrap(deps.selection);

  async function gate(ctx: ActionContext, noticeId: string) {
    const partial = (await deps.selection.settings()).renovacion_parcial_enabled;
    let selection = await startRenewalSelection({ noticeId, waId: ctx.contact.waId }, wrapped, ctx.state.variables);
    if (selection.clienteId !== ctx.contact.terceroId) throw new DomainError('Selección no disponible.', 'RENEWAL_SELECTION_UNAVAILABLE');
    if (!partial) selection = applySelectionAction(selection, { type: 'selectAll' });
    return { selection, partial };
  }

  async function confirm(ctx: ActionContext, selection: RenewalSelection, texts: RenewMessages): Promise<ActionResult> {
    // Orders are idempotent by intent key, so creating them while planning is safe on replay or CAS retry.
    const orders = await createRenewalOrder({ selection: applySelectionAction(selection, { type: 'confirm' }) }, wrapped);
    const [first, ...rest] = orders;
    if (!first) return { state: cleared(ctx.state), message: text(texts.unavailable) };
    const state = cleared(ctx.state, { pedido_id: first.id, pedido_queue: rest.length ? rest.map(o => o.id).join(',') : null });
    const next = await chain?.({ ...ctx, state, params: { pedido_id: first.id } });
    if (next) return next;
    return { state, message: text(renderTemplate(texts.ordered, { pedidos: String(orders.length),
      total: orders.map(o => `${o.total.toFixed(2)} ${o.moneda}`).join(' + ') })) };
  }

  async function decline(ctx: ActionContext, selection: RenewalSelection, partial: boolean, texts: RenewMessages,
    template: string): Promise<ActionResult | null> {
    let after = partial ? selection : applySelectionAction(selection, { type: 'clear' });
    for (const item of selection.items.filter(i => !i.reason && !after.selected.includes(i.ventaId))) {
      after = applySelectionAction(after, { type: 'decline', ventaId: item.ventaId });
    }
    const execute = async () => { await declineSelected({ selection: after }, wrapped); };
    const view = partial && after.selected.length ? render(ctx, after, partial, texts, template, 0) : null;
    return view ? { ...view, execute } : { state: cleared(ctx.state), message: text(texts.declined), execute };
  }

  async function run(ctx: ActionContext, noticeId: string, route: RenewRoute | null): Promise<ActionResult | null> {
    const texts = await deps.messages();
    try {
      const { selection, partial } = await gate(ctx, noticeId);
      const template = await deps.template();
      const savedPage = Number(ctx.state.variables.renewal_page);
      const page = Number.isInteger(savedPage) && savedPage >= 0 ? savedPage : 0;
      if (!route) return render(ctx, selection, partial, texts, template, 0);
      const apply = (action: SelectionAction) => render(ctx, applySelectionAction(selection, action), partial, texts, template, page);
      if (route.kind === 'confirm') {
        return selection.selected.length ? await confirm(ctx, selection, texts)
          : render(ctx, selection, partial, texts, template, page, `${texts.emptySelection}\n`);
      }
      if (route.kind === 'decline') return decline(ctx, selection, partial, texts, template);
      if (!partial) return null;
      if (route.kind === 'page') return render(ctx, selection, partial, texts, template, route.value);
      if (route.kind === 'all') return apply({ type: 'selectAll' });
      if (route.kind === 'clear') return apply({ type: 'clear' });
      if (!selection.items.some(i => i.ventaId === route.value && !i.reason)) return null;
      return apply({ type: 'toggle', ventaId: route.value });
    } catch (error) {
      if (error instanceof DomainError && error.code === 'RENEWAL_SELECTION_UNAVAILABLE') {
        return { state: cleared(ctx.state), message: text(texts.unavailable) };
      }
      throw error;
    }
  }

  /** `renew_services` action: entry from a notice or the menu. Only customers bound to a third party may start. */
  const handler: ActionHandler = async ctx => {
    if (!customerOnly(ctx)) return null;
    const explicit = uuid.safeParse(ctx.params.notice_id);
    const noticeId = explicit.success ? explicit.data : await deps.latestNoticeId(ctx.contact.waId);
    if (!noticeId) return { state: ctx.state, message: text((await deps.messages()).none) };
    return run(ctx, noticeId, null);
  };
  /** Interactive replies `BOT:REN:*`. The notice comes only from our own saved session, never from the client id. */
  async function handleRoute(ctx: ActionContext, route: RenewRoute): Promise<ActionResult | null> {
    if (!customerOnly(ctx)) return null;
    const noticeId = uuid.safeParse(ctx.state.variables.renewal_notice);
    if (!noticeId.success || !ctx.state.awaiting) return null;
    return run(ctx, noticeId.data, route);
  }
  return { handler, handleRoute };
}

/** Pops the next pending order after one is paid; returns state variables for the next `request_payment` turn. */
export function nextRenewalOrder(variables: ConversationState['variables']): ConversationState['variables'] | null {
  const queue = typeof variables.pedido_queue === 'string' ? variables.pedido_queue.split(',').filter(id => uuid.safeParse(id).success) : [];
  const [next, ...rest] = queue;
  return next ? { ...variables, pedido_id: next, pedido_queue: rest.length ? rest.join(',') : null } : null;
}
