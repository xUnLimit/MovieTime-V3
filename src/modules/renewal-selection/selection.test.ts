import { describe, expect, it } from 'vitest';
import { applySelectionAction, renewalTotal, selectedByCurrency, selectionSchema, type RenewalItem, type RenewalSelection } from './selection';
import { renderRenewalSummary } from './summary';
import { rebuildRenewalSelection, serializeRenewalSelection } from './session';
import { conversationStateSchema } from '@/platform/validation/conversation-state';

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function state(count = 3): RenewalSelection {
  return { noticeId: id(999), waId: '50760000000', clienteId: id(998), expiresAt: '2026-10-02T12:30:00Z',
    selected: [], declined: [], confirmed: false,
    items: Array.from({ length: count }, (_, n): RenewalItem => ({ ventaId: id(n), clienteId: id(998), periodId: id(900 + n),
      servicio: `Servicio ${n}`, perfil: 'Perfil 1', vencimiento: '2026-10-02', ciclo: 'mensual',
      precio: 0.1, moneda: 'USD', reason: null })) };
}
const now = new Date('2026-10-02T12:00:00Z');
describe('renewal selection', () => {
  it('selects all, some and none; toggling twice restores the choice', () => {
    let s = state();
    expect(() => applySelectionAction(s, { type: 'confirm' })).toThrow();
    s = applySelectionAction(s, { type: 'toggle', ventaId: id(0) });
    expect(s.selected).toEqual([id(0)]);
    s = applySelectionAction(s, { type: 'toggle', ventaId: id(0) });
    expect(s.selected).toEqual([]);
    s = applySelectionAction(s, { type: 'selectAll' });
    expect(s.selected).toHaveLength(3);
    expect(renewalTotal(s.items)).toBe(0.3);
    s = applySelectionAction(s, { type: 'confirm' });
    expect(s.confirmed).toBe(true);
    expect(applySelectionAction(s, { type: 'clear' }).selected).toEqual([]);
  });
  it('keeps decline separate and allows editing it before persistence', () => {
    let s = applySelectionAction(state(), { type: 'selectAll' });
    s = applySelectionAction(s, { type: 'decline', ventaId: id(0) });
    expect(s.selected).toHaveLength(2);
    expect(s.declined).toEqual([id(0)]);
    expect(renderRenewalSummary(s).text).toContain('− Servicio 0');
    s = applySelectionAction(s, { type: 'toggle', ventaId: id(0) });
    expect(s.declined).toEqual([]);
    s = applySelectionAction(s, { type: 'decline', ventaId: id(1) });
    expect(applySelectionAction(s, { type: 'clear' }).declined).toEqual([]);
  });
  it.each(['cut', 'paused', 'archived', 'renewed', 'declined', 'unavailable'] as const)('excludes %s with a reason', reason => {
    const s = state(); s.items[0].reason = reason;
    expect(applySelectionAction(s, { type: 'selectAll' }).selected).not.toContain(id(0));
    expect(() => applySelectionAction(s, { type: 'toggle', ventaId: id(0) })).toThrow();
    expect(renderRenewalSummary(s).text).toContain(`(${reason})`);
  });
  it('groups currencies without summing incompatible money', () => {
    const s = state(); s.items[0].moneda = 'EUR';
    const all = applySelectionAction(s, { type: 'selectAll' });
    expect(selectedByCurrency(all).size).toBe(2);
    expect(renderRenewalSummary(all).text).toContain('0.10 EUR + 0.20 USD');
    expect(renderRenewalSummary(state()).text).toContain('Total: 0.00');
  });
  it('paginates ten rows and supports editable markers', () => {
    const all = applySelectionAction(state(21), { type: 'selectAll' });
    expect(renderRenewalSummary(all).text.match(/✓ Servicio/g)).toHaveLength(10);
    expect(renderRenewalSummary(all, 2).text.match(/✓ Servicio/g)).toHaveLength(1);
    expect(renderRenewalSummary(all, 1, '{{moneda}} {{total}}\n{{servicios}}').text).toContain('USD 2.10');
    expect(() => renderRenewalSummary(all, 3)).toThrow();
    expect(() => renderRenewalSummary(all, 0, 'invalid')).toThrow();
    const large = '{{servicios}}'.repeat(60) + '{{total}} {{moneda}}';
    expect(() => renderRenewalSummary(all, 0, large)).toThrow();
  });
  it('round trips 100 references within conversation limits, excluding secrets', () => {
    const s = applySelectionAction(state(100), { type: 'selectAll' });
    const session = serializeRenewalSelection(s, 'renewal_choose');
    expect(conversationStateSchema.safeParse({ flowVersion: 1, nodeId: 'renewal_choose', owner: 'bot', ...session }).success).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(session.variables)).length).toBeLessThan(4096);
    expect(JSON.stringify(session)).not.toContain('Servicio');
    expect(rebuildRenewalSelection(s, s.items, session.variables, now).selected).toEqual(s.selected);
  });
  it('rebuilds expired, malformed or mismatched state from fresh DB items', () => {
    const s = applySelectionAction(state(), { type: 'selectAll' });
    const saved = serializeRenewalSelection(s, 'renewal_choose').variables;
    for (const value of [null, { ...saved, renewal_notice: id(777) }, { ...saved, renewal_refs_0: 'bad' }]) {
      expect(rebuildRenewalSelection(s, s.items, value, now).selected).toEqual([]);
    }
    expect(rebuildRenewalSelection(s, s.items, saved, new Date('2026-10-02T13:00:00Z')).selected).toEqual([]);
    const fresh = s.items.map(i => ({ ...i, reason: 'renewed' as const }));
    expect(rebuildRenewalSelection(s, fresh, saved, now).selected).toEqual([]);
  });
  it('restores confirmed and declined choices and rejects invalid identities', () => {
    let s = applySelectionAction(state(), { type: 'selectAll' });
    s = applySelectionAction(s, { type: 'decline', ventaId: id(0) });
    s = applySelectionAction(s, { type: 'confirm' });
    expect(rebuildRenewalSelection(s, s.items, serializeRenewalSelection(s, 'renewal_choose').variables, now)).toEqual(s);
    expect(selectionSchema.safeParse({ ...s, items: [s.items[0], s.items[0]] }).success).toBe(false);
    expect(selectionSchema.safeParse({ ...s, selected: [id(333)] }).success).toBe(false);
    expect(selectionSchema.safeParse({ ...s, clienteId: id(333) }).success).toBe(false);
  });
  it('requires fresh confirmation when restored DB prices or periods changed', () => {
    const s = applySelectionAction(applySelectionAction(state(), { type: 'selectAll' }), { type: 'confirm' });
    const saved = serializeRenewalSelection(s, 'renewal_choose').variables;
    for (const items of [s.items.map(i => ({ ...i, precio: 5 })), s.items.map(i => ({ ...i, periodId: id(555) }))]) {
      const rebuilt = rebuildRenewalSelection(s, items, saved, now);
      expect(rebuilt.selected).toEqual(s.selected);
      expect(rebuilt.confirmed).toBe(false);
    }
  });
});
