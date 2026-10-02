import { createHash } from 'node:crypto';
import { applySelectionAction, selectionSchema, renewalItemSchema, selectedByCurrency,
  type RenewalItem, type RenewalSelection, type SelectionAction } from '@/modules/renewal-selection/selection';
import { rebuildRenewalSelection } from '@/modules/renewal-selection/session';
import type { NoticeReplyStore } from '@/modules/messaging/notice-reply-store';
import type { NoticeRecord } from '@/modules/messaging/notice-store';
import { DomainError } from '@/platform/errors/domain-errors';
import { createLogger } from '@/platform/observability/logger';
import { z } from '@/platform/validation/zod';
import type { RenewalOrderInput } from '@/platform/supabase/renewal-selection-rpc-adapter';

export type RenewalSelectionDeps = {
  settings(): Promise<{ renovacion_parcial_enabled: boolean; notice_max_age_days: number; selection_ttl_minutes: number }>;
  replies: Pick<NoticeReplyStore, 'findNotice' | 'ventaIds' | 'declineVentas'>;
  ownsCustomer(waId: string, clienteId: string): Promise<boolean>;
  loadItems(notice: NoticeRecord, ids: string[]): Promise<RenewalItem[]>;
  createOrder(input: RenewalOrderInput): Promise<string>;
  readOrder(id: string): Promise<{ id: string; total: number; moneda: string } | null>;
  exchangeRate(moneda: string): Promise<number>;
  notifyAdmins(body: string): Promise<void>;
  now(): Date;
};
const startSchema = z.object({ noticeId: z.string().uuid(), waId: z.string().regex(/^\d{8,15}$/) }).strict();
const settingsSchema = z.object({ renovacion_parcial_enabled: z.boolean(),
  notice_max_age_days: z.number().int().min(1).max(30), selection_ttl_minutes: z.number().int().min(1).max(1440) });
function reject(): never { throw new DomainError('La selección no está disponible. Solicita un aviso nuevo.', 'RENEWAL_SELECTION_UNAVAILABLE'); }

export async function startRenewalSelection(input: z.infer<typeof startSchema>, deps: RenewalSelectionDeps,
  saved?: unknown): Promise<RenewalSelection> {
  const { noticeId, waId } = startSchema.parse(input);
  const settings = settingsSchema.parse(await deps.settings());
  if (!settings.renovacion_parcial_enabled) reject();
  const notice = await deps.replies.findNotice(noticeId);
  const now = deps.now();
  const age = notice ? now.getTime() - Date.parse(notice.created_at) : NaN;
  if (!notice || notice.status !== 'accepted' || notice.wa_id !== waId
    || !['notificacion_regular', 'dia_pago', 'cancelacion'].includes(notice.tipo)
    || !Number.isFinite(age) || age < 0 || age > Math.min(settings.notice_max_age_days, 30) * 86400000
    || !await deps.ownsCustomer(waId, notice.tercero_id)) reject();
  const ids = z.array(z.string().uuid()).min(1).max(100).parse(await deps.replies.ventaIds(noticeId));
  const items = z.array(renewalItemSchema).parse(await deps.loadItems(notice, ids));
  if (items.length !== ids.length || items.some(i => !ids.includes(i.ventaId) || i.clienteId !== notice.tercero_id)) reject();
  return rebuildRenewalSelection({ noticeId, waId, clienteId: notice.tercero_id,
    expiresAt: new Date(now.getTime() + settings.selection_ttl_minutes * 60000).toISOString() }, items, saved, now);
}

async function refresh(input: RenewalSelection, deps: RenewalSelectionDeps): Promise<RenewalSelection> {
  const old = selectionSchema.parse(input);
  if (Date.parse(old.expiresAt) <= deps.now().getTime()) reject();
  const fresh = await startRenewalSelection({ noticeId: old.noticeId, waId: old.waId }, deps);
  if (fresh.clienteId !== old.clienteId) reject();
  for (const id of [...old.selected, ...old.declined]) {
    const before = old.items.find(i => i.ventaId === id);
    const current = fresh.items.find(i => i.ventaId === id);
    // Declined sales are retained for idempotent decline retries only.
    if (!before || !current || (current.reason && !(old.declined.includes(id) && current.reason === 'declined'))
      || before.periodId !== current.periodId || before.precio !== current.precio || before.moneda !== current.moneda
      || before.ciclo !== current.ciclo) reject();
  }
  return { ...fresh, expiresAt: old.expiresAt, selected: old.selected,
    declined: old.declined.filter(id => fresh.items.some(i => i.ventaId === id && !i.reason)), confirmed: old.confirmed };
}

export async function applySelection(input: { selection: RenewalSelection; action: SelectionAction }, deps: RenewalSelectionDeps) {
  return applySelectionAction(await refresh(input.selection, deps), input.action);
}

function intentKey(noticeId: string, currency: string, items: RenewalItem[]): string {
  const canonical = items.map(i => [i.ventaId, i.periodId, i.ciclo, i.precio]).sort(([a], [b]) => String(a).localeCompare(String(b)));
  const h = createHash('sha256').update(JSON.stringify(['renewal-selection-v1', noticeId, currency, canonical])).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function createRenewalOrder(input: { selection: RenewalSelection }, deps: RenewalSelectionDeps) {
  // The SQL wrapper revalidates eligibility atomically and permits replay after renewal.
  const selection = selectionSchema.parse(input.selection);
  if (!selection.confirmed) reject();
  const fresh = await startRenewalSelection({ noticeId: selection.noticeId, waId: selection.waId }, deps);
  if (fresh.clienteId !== selection.clienteId || selection.selected.some(id => !fresh.items.some(i => i.ventaId === id))) reject();
  const results: { id: string; total: number; moneda: string }[] = [];
  for (const [moneda, items] of [...selectedByCurrency(selection)].sort(([a], [b]) => a.localeCompare(b))) {
    const id = await deps.createOrder({ p_tercero_id: selection.clienteId, p_contact_id: null,
      p_canal: 'whatsapp', p_moneda: moneda,
      p_items: items.map(i => ({ tipo: 'renovacion', venta_id: i.ventaId, ciclo_pago: i.ciclo, descuento: 0 })),
      p_expira_at: selection.expiresAt, p_exchange_rate: await deps.exchangeRate(moneda),
      p_idempotency_key: intentKey(selection.noticeId, moneda, items),
      p_notice_id: selection.noticeId, p_wa_id: selection.waId,
      p_expected: items.map(i => ({ venta_id: i.ventaId, period_id: i.periodId, precio: i.precio })),
    });
    const order = await deps.readOrder(id);
    if (!order || order.moneda !== moneda) reject();
    results.push(order);
  }
  return results;
}

export async function declineSelected(input: { selection: RenewalSelection }, deps: RenewalSelectionDeps) {
  const selection = await refresh(input.selection, deps);
  if (!selection.declined.length) return false;
  const changed = await deps.replies.declineVentas(selection.declined, deps.now().toISOString());
  if (changed) {
    try {
      await deps.notifyAdmins(`El cliente no desea continuar con ${selection.items.filter(i => selection.declined.includes(i.ventaId)).map(i => i.servicio).join(', ')}`);
    } catch (error) { createLogger('RenewalSelection').warn('Admin push failed', { error }); }
  }
  return changed;
}
