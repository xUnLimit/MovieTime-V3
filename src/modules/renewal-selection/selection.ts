import { z } from '@/platform/validation/zod';

const uuid = z.string().uuid();
export const renewalItemSchema = z.object({
  ventaId: uuid, clienteId: uuid, periodId: uuid,
  servicio: z.string().max(120), perfil: z.string().max(80),
  vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ciclo: z.enum(['mensual', 'trimestral', 'semestral', 'anual']),
  precio: z.number().finite().min(0).max(9999999999.99).multipleOf(0.01),
  moneda: z.string().regex(/^[A-Z]{3}$/),
  reason: z.enum(['cut', 'paused', 'archived', 'renewed', 'declined', 'unavailable']).nullable(),
}).strict();
export const selectionSchema = z.object({
  noticeId: uuid, waId: z.string().regex(/^\d{8,15}$/), clienteId: uuid,
  expiresAt: z.iso.datetime({ offset: true }),
  items: z.array(renewalItemSchema).max(100), selected: z.array(uuid).max(100),
  declined: z.array(uuid).max(100), confirmed: z.boolean(),
}).strict().superRefine((s, ctx) => {
  const ids = s.items.map(i => i.ventaId);
  const choices = [...s.selected, ...s.declined];
  if (new Set(ids).size !== ids.length || new Set(choices).size !== choices.length
    || choices.some(id => !s.items.some(i => i.ventaId === id && i.reason === null))
    || s.items.some(i => i.clienteId !== s.clienteId) || (s.confirmed && !s.selected.length)) {
    ctx.addIssue({ code: 'custom', message: 'Selección inválida.' });
  }
});
export type RenewalItem = z.infer<typeof renewalItemSchema>;
export type RenewalSelection = z.infer<typeof selectionSchema>;
const selectionActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('toggle'), ventaId: uuid }).strict(),
  z.object({ type: z.literal('decline'), ventaId: uuid }).strict(),
  z.object({ type: z.literal('selectAll') }).strict(),
  z.object({ type: z.literal('clear') }).strict(),
  z.object({ type: z.literal('confirm') }).strict(),
]);
export type SelectionAction = z.infer<typeof selectionActionSchema>;

// Locale-independent order so serialized selections and their fingerprints stay deterministic.
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function applySelectionAction(input: RenewalSelection, action: SelectionAction): RenewalSelection {
  const state = selectionSchema.parse(input);
  const a = selectionActionSchema.parse(action);
  const selected = new Set(state.selected);
  const declined = new Set(state.declined);
  if ('ventaId' in a) {
    if (!state.items.some(i => i.ventaId === a.ventaId && i.reason === null)) {
      throw new Error('El servicio no está disponible.');
    }
    if (a.type === 'decline') { selected.delete(a.ventaId); declined.add(a.ventaId); }
    else { declined.delete(a.ventaId); if (!selected.delete(a.ventaId)) selected.add(a.ventaId); }
  }
  if (a.type === 'selectAll') {
    state.items.filter(i => !i.reason).forEach(i => selected.add(i.ventaId));
    declined.clear();
  }
  if (a.type === 'clear') { selected.clear(); declined.clear(); }
  return selectionSchema.parse({ ...state, selected: [...selected].sort(byCodePoint), declined: [...declined].sort(byCodePoint),
    confirmed: a.type === 'confirm' });
}

export function selectedByCurrency(state: RenewalSelection): Map<string, RenewalItem[]> {
  const parsed = selectionSchema.parse(state);
  const groups = new Map<string, RenewalItem[]>();
  for (const item of parsed.items.filter(i => parsed.selected.includes(i.ventaId))) {
    groups.set(item.moneda, [...(groups.get(item.moneda) ?? []), item]);
  }
  return groups;
}

export function renewalTotal(items: readonly RenewalItem[]): number {
  return items.reduce((sum, i) => sum + Math.round(i.precio * 100), 0) / 100;
}
