import { describe, expect, it, vi } from 'vitest';
import type { NoticeRecord } from '@/modules/messaging/notice-store';
import type { RenewalItem } from '@/modules/renewal-selection/selection';
import { defaultRenewalTemplate } from '@/modules/renewal-selection/summary';
import { conversationStateSchema, type ConversationState } from '@/platform/validation/conversation-state';
import type { RenewalSelectionDeps } from '../renewal-selection-use-cases';
import type { ActionContext, ActionHandler, ActionResult } from './contracts';
import { createRenewalFlow, nextRenewalOrder, type RenewDeps } from './renew-flow';
import { defaultRenewMessages, renewMessagesSchema } from './renew-messages';
import { renewId, renewRoute } from './renew-routes';

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date('2026-10-02T12:00:00Z');
const WA = '50760000000';
const CLIENT = id(2);
const notice: NoticeRecord = { id: id(1), dedupe_key: 'test', tipo: 'dia_pago', tercero_id: CLIENT,
  wa_id: WA, channel: 'template', meta_template_name: null, fecha_vencimiento: '2026-10-02',
  origin: 'manual', status: 'accepted', skip_reason: null, idempotency_key: id(3), outbound_message_id: null,
  wa_message_id: null, created_by: null, created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z' };
const item = (n: number, patch: Partial<RenewalItem> = {}): RenewalItem => ({ ventaId: id(10 + n), clienteId: CLIENT,
  periodId: id(20 + n), servicio: `Servicio ${n}`, perfil: `Perfil ${n}`, vencimiento: '2026-10-02', ciclo: 'mensual',
  precio: 5, moneda: 'USD', reason: null, ...patch });

function setup(items: RenewalItem[] = [item(1), item(2), item(3)], partial = true, chain?: ActionHandler) {
  const selection = {
    settings: vi.fn().mockResolvedValue({ renovacion_parcial_enabled: partial, notice_max_age_days: 30, selection_ttl_minutes: 30 }),
    replies: { findNotice: vi.fn().mockResolvedValue(notice), ventaIds: vi.fn().mockResolvedValue(items.map(i => i.ventaId)),
      declineVentas: vi.fn().mockResolvedValue(true) },
    ownsCustomer: vi.fn().mockResolvedValue(true), loadItems: vi.fn().mockResolvedValue(items),
    createOrder: vi.fn().mockImplementation(async (input: { p_moneda: string }) => id(input.p_moneda === 'USD' ? 90 : 91)),
    readOrder: vi.fn().mockImplementation(async (orderId: string) => ({ id: orderId, total: 10, moneda: orderId === id(90) ? 'USD' : 'PAB' })),
    exchangeRate: vi.fn().mockResolvedValue(1), notifyAdmins: vi.fn().mockResolvedValue(undefined), now: () => NOW,
  } satisfies RenewalSelectionDeps;
  const deps: RenewDeps = { selection, messages: async () => defaultRenewMessages(),
    template: async () => defaultRenewalTemplate, latestNoticeId: vi.fn().mockResolvedValue(notice.id) };
  return { selection, deps, flow: createRenewalFlow(deps, chain) };
}
function ctx(state?: Partial<ConversationState>, contact: Partial<ActionContext['contact']> = {}, params = {}): ActionContext {
  return { run: {} as unknown as ActionContext['run'], params, contact: { waId: WA, terceroId: CLIENT, estado: 'cliente', ...contact },
    state: { flowVersion: 1, nodeId: 'renovar', variables: {}, awaiting: null, owner: 'bot', ...state } };
}
const rowIds = (result: ActionResult | null) => result?.message?.kind === 'list' ? result.message.rows.map(r => r.id) : [];

describe('renew_services flow', () => {
  it('shows a persisted list with toggle and control rows and stores only ids', async () => {
    const { flow } = setup();
    const result = await flow.handler(ctx())!;
    expect(rowIds(result)).toEqual([renewId('toggle', id(11)), renewId('toggle', id(12)), renewId('toggle', id(13)),
      renewId('all'), renewId('clear'), renewId('decline'), renewId('confirm')]);
    const state = result!.state;
    expect(conversationStateSchema.safeParse(state).success).toBe(true);
    expect(state.variables.renewal_notice).toBe(notice.id);
    expect(JSON.stringify(state)).not.toMatch(/Servicio|Perfil|5\.00/);
    expect(state.awaiting?.ref).toBe('renovar');
  });
  it('blocks leads, unlinked customers and uses the latest notice when none is given', async () => {
    const { flow, deps } = setup();
    expect(await flow.handler(ctx(undefined, { estado: 'lead' }))).toBeNull();
    expect(await flow.handler(ctx(undefined, { terceroId: null }))).toBeNull();
    await flow.handler(ctx());
    expect(deps.latestNoticeId).toHaveBeenCalledWith(WA);
    vi.mocked(deps.latestNoticeId).mockResolvedValueOnce(null);
    expect((await flow.handler(ctx()))?.message).toEqual({ kind: 'text', text: defaultRenewMessages().none });
  });
  it('prefers a valid explicit notice param and ignores an invalid one', async () => {
    const { flow, deps, selection } = setup();
    await flow.handler(ctx(undefined, {}, { notice_id: notice.id }));
    expect(deps.latestNoticeId).not.toHaveBeenCalled();
    await flow.handler(ctx(undefined, {}, { notice_id: 'bad' }));
    expect(deps.latestNoticeId).toHaveBeenCalled();
    expect(selection.replies.findNotice).toHaveBeenCalledTimes(2);
  });
  it('rejects a notice that belongs to another customer without leaking data', async () => {
    const { flow } = setup();
    const result = await flow.handler(ctx(undefined, { terceroId: id(77) }));
    expect(result?.message).toEqual({ kind: 'text', text: defaultRenewMessages().unavailable });
    const unowned = setup(); unowned.selection.ownsCustomer.mockResolvedValue(false);
    expect((await unowned.flow.handler(ctx()))?.message).toEqual({ kind: 'text', text: defaultRenewMessages().unavailable });
  });
  it('toggles, selects all, clears and confirms through strict routes', async () => {
    const { flow, selection } = setup();
    let current = (await flow.handler(ctx()))!;
    const press = async (route: string) => {
      const parsed = renewRoute(route)!;
      current = (await flow.handleRoute(ctx(current.state), parsed))!;
    };
    await press(renewId('toggle', id(11)));
    expect(current.message?.kind === 'list' && current.message.rows[0].title.startsWith('✓')).toBe(true);
    await press(renewId('toggle', id(11)));
    expect(current.message?.kind === 'list' && current.message.rows[0].title.startsWith('□')).toBe(true);
    await press(renewId('all'));
    await press(renewId('clear'));
    await press(renewId('confirm'));
    expect(current.message?.kind === 'list' && current.message.body).toContain(defaultRenewMessages().emptySelection);
    expect(selection.createOrder).not.toHaveBeenCalled();
    await press(renewId('all'));
    await press(renewId('confirm'));
    expect(selection.createOrder).toHaveBeenCalledTimes(1);
    expect(selection.createOrder.mock.calls[0][0].p_items).toHaveLength(3);
    expect(current.state.variables).toMatchObject({ pedido_id: id(90), pedido_queue: null });
    expect(Object.keys(current.state.variables).some(k => k.startsWith('renewal_'))).toBe(false);
    expect(current.state.awaiting).toBeNull();
    expect(current.message).toEqual({ kind: 'text', text: 'Preparamos 1 pedido(s) de renovación. Total: 10.00 USD' });
  });
  it('creates one order per currency, queues the rest and chains to payment', async () => {
    const chain = vi.fn<ActionHandler>(async c => ({ state: c.state, message: { kind: 'text', text: 'pago' } }));
    const { flow, selection } = setup([item(1), item(2, { moneda: 'PAB' })], true, chain);
    let current = (await flow.handler(ctx()))!;
    for (const route of [renewId('all'), renewId('confirm')]) current = (await flow.handleRoute(ctx(current.state), renewRoute(route)!))!;
    expect(selection.createOrder).toHaveBeenCalledTimes(2);
    expect(current.message).toEqual({ kind: 'text', text: 'pago' });
    expect(chain.mock.calls[0][0].params).toEqual({ pedido_id: id(91) });
    expect(current.state.variables).toMatchObject({ pedido_id: id(91), pedido_queue: id(90) });
    expect(nextRenewalOrder(current.state.variables)).toMatchObject({ pedido_id: id(90), pedido_queue: null });
    expect(nextRenewalOrder({ pedido_id: id(91), pedido_queue: null })).toBeNull();
    expect(nextRenewalOrder({ pedido_queue: 'x,y' })).toBeNull();
  });
  it('paginates five services per page', async () => {
    const { flow } = setup(Array.from({ length: 7 }, (_, i) => item(i + 1)));
    const first = (await flow.handler(ctx()))!;
    expect(rowIds(first)).toContain(renewId('page', 1));
    const second = (await flow.handleRoute(ctx(first.state), renewRoute(renewId('page', 1))!))!;
    expect(rowIds(second).filter(r => r.includes(':toggle:'))).toHaveLength(2);
    expect(await flow.handleRoute(ctx(first.state), renewRoute(renewId('page', 5))!)).toBeNull();
  });
  it('does not trust ids: unknown or ineligible sales and sessionless routes fail closed', async () => {
    const { flow } = setup([item(1), item(2, { reason: 'renewed' })]);
    const start = (await flow.handler(ctx()))!;
    expect(await flow.handleRoute(ctx(start.state), renewRoute(renewId('toggle', id(99)))!)).toBeNull();
    expect(await flow.handleRoute(ctx(start.state), renewRoute(renewId('toggle', id(12)))!)).toBeNull();
    expect(await flow.handleRoute(ctx(), renewRoute(renewId('all'))!)).toBeNull();
    expect(await flow.handleRoute(ctx(start.state, { estado: 'lead' }), renewRoute(renewId('all'))!)).toBeNull();
  });
  it('declines unselected services persistently and keeps the list while some are selected', async () => {
    const { flow, selection } = setup();
    let current = (await flow.handler(ctx()))!;
    current = (await flow.handleRoute(ctx(current.state), renewRoute(renewId('toggle', id(11)))!))!;
    const decline = (await flow.handleRoute(ctx(current.state), renewRoute(renewId('decline'))!))!;
    expect(decline.message?.kind).toBe('list');
    await decline.execute!();
    expect(selection.replies.declineVentas).toHaveBeenCalledWith([id(12), id(13)], NOW.toISOString());
    const none = (await flow.handleRoute(ctx((await flow.handler(ctx()))!.state), renewRoute(renewId('decline'))!))!;
    expect(none.message).toEqual({ kind: 'text', text: defaultRenewMessages().declined });
    expect(none.state.awaiting).toBeNull();
  });
  it('renews the whole notice with confirm/decline buttons when partial renewal is off', async () => {
    const { flow, selection } = setup([item(1), item(2)], false);
    const start = (await flow.handler(ctx()))!;
    expect(start.message?.kind === 'buttons' && start.message.buttons.map(b => b.id)).toEqual([renewId('confirm'), renewId('decline')]);
    expect(start.message?.kind === 'buttons' && start.message.body).toContain(defaultRenewMessages().partialOff);
    for (const route of ['all', 'clear', 'page', 'toggle'] as const) {
      const value = route === 'toggle' ? id(11) : route === 'page' ? 0 : '0';
      expect(await flow.handleRoute(ctx(start.state), renewRoute(renewId(route, value))!)).toBeNull();
    }
    const done = (await flow.handleRoute(ctx(start.state), renewRoute(renewId('confirm'))!))!;
    expect(selection.createOrder.mock.calls[0][0].p_items).toHaveLength(2);
    expect(done.state.variables.pedido_id).toBe(id(90));
    const declined = (await flow.handleRoute(ctx(start.state), renewRoute(renewId('decline'))!))!;
    await declined.execute!();
    expect(selection.replies.declineVentas).toHaveBeenCalledWith([id(11), id(12)], NOW.toISOString());
  });
  it('reports nothing to renew when every service is ineligible and propagates infrastructure errors', async () => {
    const { flow, selection } = setup([item(1, { reason: 'renewed' })]);
    expect((await flow.handler(ctx()))?.message).toEqual({ kind: 'text', text: defaultRenewMessages().none });
    selection.replies.findNotice.mockRejectedValueOnce(new Error('db down'));
    await expect(flow.handler(ctx())).rejects.toThrow('db down');
  });
  it('falls back to a compact summary for long notices and an unavailable message if state would overflow', async () => {
    const { flow } = setup(Array.from({ length: 12 }, (_, i) => item(i + 1)));
    const result = (await flow.handler(ctx()))!;
    expect(result.message?.kind === 'list' && result.message.body).toBe('0 servicio(s) seleccionado(s). Total: 0.00');
    const full = setup(Array.from({ length: 12 }, (_, i) => item(i + 1)));
    const big = ctx({ variables: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`extra_${i}`, 'x'])) });
    expect((await full.flow.handler(big))?.message).toEqual({ kind: 'text', text: defaultRenewMessages().unavailable });
  });
});

describe('renew routes and messages', () => {
  it('decodes only well formed ids', () => {
    expect(renewRoute(renewId('toggle', id(1)))).toEqual({ kind: 'toggle', value: id(1) });
    expect(renewRoute('BOT:REN:page:2')).toEqual({ kind: 'page', value: 2 });
    for (const bad of ['BOT:REN:toggle:x', 'BOT:REN:all:1', 'BOT:REN:page:-1', 'BOT:CAT:all:0', 'BOT:REN:other:0',
      'BOT:REN:all', `BOT:REN:all:0:${'x'.repeat(130)}`]) expect(renewRoute(bad)).toBeNull();
  });
  it('validates editable templates', () => {
    expect(renewMessagesSchema.safeParse(defaultRenewMessages()).success).toBe(true);
    expect(renewMessagesSchema.safeParse({ ...defaultRenewMessages(), ordered: '{{otro}}' }).success).toBe(false);
    expect(renewMessagesSchema.safeParse({ ...defaultRenewMessages(), confirm: 'x'.repeat(25) }).success).toBe(false);
  });
});
