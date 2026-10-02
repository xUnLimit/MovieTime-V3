import { describe, expect, it, vi } from 'vitest';
import type { NoticeRecord } from '@/modules/messaging/notice-store';
import type { RenewalItem } from '@/modules/renewal-selection/selection';
import { serializeRenewalSelection } from '@/modules/renewal-selection/session';
import { startRenewalSelection, applySelection, createRenewalOrder, declineSelected, type RenewalSelectionDeps } from './renewal-selection-use-cases';

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = new Date('2026-10-02T12:00:00Z');
const notice: NoticeRecord = { id: id(1), dedupe_key: 'test', tipo: 'dia_pago', tercero_id: id(2),
  wa_id: '50760000000', channel: 'template', meta_template_name: null, fecha_vencimiento: '2026-10-02',
  origin: 'manual', status: 'accepted', skip_reason: null, idempotency_key: id(3), outbound_message_id: null,
  wa_message_id: null, created_by: null, created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z' };
const item: RenewalItem = { ventaId: id(4), clienteId: id(2), periodId: id(5), servicio: 'Servicio', perfil: 'Perfil 1',
  vencimiento: '2026-10-02', ciclo: 'mensual', precio: 5, moneda: 'USD', reason: null };
function fixture() {
  return { settings: vi.fn().mockResolvedValue({ renovacion_parcial_enabled: true, notice_max_age_days: 30, selection_ttl_minutes: 30 }),
    replies: { findNotice: vi.fn().mockResolvedValue(notice), ventaIds: vi.fn().mockResolvedValue([item.ventaId]),
      declineVentas: vi.fn().mockResolvedValue(true) },
    ownsCustomer: vi.fn().mockResolvedValue(true), loadItems: vi.fn().mockResolvedValue([item]),
    createOrder: vi.fn().mockResolvedValue(id(9)), readOrder: vi.fn().mockResolvedValue({ id: id(9), total: 5, moneda: 'USD' }),
    exchangeRate: vi.fn().mockResolvedValue(1), notifyAdmins: vi.fn().mockResolvedValue(undefined), now: () => now,
  } satisfies RenewalSelectionDeps;
}
const input = { noticeId: notice.id, waId: notice.wa_id };
async function confirmed(deps: RenewalSelectionDeps) {
  const selection = await startRenewalSelection(input, deps);
  const all = await applySelection({ selection, action: { type: 'selectAll' } }, deps);
  return applySelection({ selection: all, action: { type: 'confirm' } }, deps);
}
describe('renewal use cases', () => {
  it('starts empty and rebuilds an expired saved state', async () => {
    const deps = fixture();
    const s = await confirmed(deps);
    const saved = serializeRenewalSelection({ ...s, expiresAt: '2026-10-02T11:00:00Z' }, 'renewal_choose');
    expect((await startRenewalSelection(input, deps, saved.variables)).selected).toEqual([]);
  });
  it('validates IDs before reading', async () => {
    const deps = fixture();
    await expect(startRenewalSelection({ ...input, noticeId: 'bad' }, deps)).rejects.toThrow();
    expect(deps.replies.findNotice).not.toHaveBeenCalled();
  });
  it.each([
    { status: 'failed' }, { wa_id: '50761111111' }, { tipo: 'datos_pago' },
    { created_at: '2026-08-01T12:00:00Z' }, { created_at: '2026-10-03T12:00:00Z' }, { created_at: 'bad' },
  ])('rejects an invalid or stale notice %j', async patch => {
    const deps = fixture(); deps.replies.findNotice.mockResolvedValue({ ...notice, ...patch });
    await expect(startRenewalSelection(input, deps)).rejects.toMatchObject({ code: 'RENEWAL_SELECTION_UNAVAILABLE' });
    expect(deps.loadItems).not.toHaveBeenCalled();
  });
  it('rejects missing notices, disabled feature, foreign and missing sales', async () => {
    const deps = fixture(); deps.replies.findNotice.mockResolvedValueOnce(null);
    await expect(startRenewalSelection(input, deps)).rejects.toThrow();
    deps.settings.mockResolvedValueOnce({ renovacion_parcial_enabled: false });
    await expect(startRenewalSelection(input, deps)).rejects.toThrow();
    deps.ownsCustomer.mockResolvedValueOnce(false);
    await expect(startRenewalSelection(input, deps)).rejects.toThrow();
    deps.loadItems.mockResolvedValueOnce([{ ...item, clienteId: id(44) }]);
    await expect(startRenewalSelection(input, deps)).rejects.toThrow();
    deps.loadItems.mockResolvedValueOnce([]);
    await expect(startRenewalSelection(input, deps)).rejects.toThrow();
  });
  it('rejects expired choices and changed price, cycle, currency or period', async () => {
    const deps = fixture(); const selection = await confirmed(deps);
    await expect(applySelection({ selection: { ...selection, expiresAt: now.toISOString() }, action: { type: 'clear' } }, deps)).rejects.toThrow();
    for (const patch of [{ precio: 6 }, { ciclo: 'anual' }, { moneda: 'EUR' }, { periodId: id(66) }, { reason: 'cut' }]) {
      deps.loadItems.mockResolvedValueOnce([{ ...item, ...patch }]);
      await expect(applySelection({ selection, action: { type: 'confirm' } }, deps)).rejects.toThrow();
    }
  });
  it('creates a renewable pedido and keeps the same intent on replay after renewal', async () => {
    const deps = fixture(); const selection = await confirmed(deps);
    expect(await createRenewalOrder({ selection }, deps)).toEqual([{ id: id(9), total: 5, moneda: 'USD' }]);
    deps.loadItems.mockResolvedValue([{ ...item, reason: 'renewed', periodId: id(55) }]);
    await createRenewalOrder({ selection }, deps);
    const calls = deps.createOrder.mock.calls;
    expect(calls[0][0]).toEqual(calls[1][0]);
    expect(calls[0][0].p_items).toEqual([{ tipo: 'renovacion', venta_id: item.ventaId, ciclo_pago: 'mensual', descuento: 0 }]);
    expect(calls[0][0].p_expected).toEqual([{ venta_id: item.ventaId, period_id: item.periodId, precio: 5 }]);
  });
  it('requires confirmation and an authoritative order result', async () => {
    const deps = fixture(); const s = await startRenewalSelection(input, deps);
    await expect(createRenewalOrder({ selection: s }, deps)).rejects.toThrow();
    const selection = await confirmed(deps); deps.readOrder.mockResolvedValue(null);
    await expect(createRenewalOrder({ selection }, deps)).rejects.toThrow();
  });
  it('creates one order per currency in stable order', async () => {
    const deps = fixture(); deps.replies.ventaIds.mockResolvedValue([id(4), id(6)]);
    deps.loadItems.mockResolvedValue([item, { ...item, ventaId: id(6), moneda: 'EUR' }]);
    deps.readOrder.mockResolvedValueOnce({ id: id(8), total: 5, moneda: 'EUR' }).mockResolvedValueOnce({ id: id(9), total: 5, moneda: 'USD' });
    await createRenewalOrder({ selection: await confirmed(deps) }, deps);
    expect(deps.createOrder.mock.calls.map(([p]) => p.p_moneda)).toEqual(['EUR', 'USD']);
    expect(deps.createOrder.mock.calls[0][0].p_idempotency_key).not.toBe(deps.createOrder.mock.calls[1][0].p_idempotency_key);
  });
  it('declines only explicit choices; replay does not send another admin push', async () => {
    const deps = fixture(); const s = await startRenewalSelection(input, deps);
    expect(await declineSelected({ selection: s }, deps)).toBe(false);
    const selection = await applySelection({ selection: s, action: { type: 'decline', ventaId: item.ventaId } }, deps);
    expect(await declineSelected({ selection }, deps)).toBe(true);
    expect(deps.replies.declineVentas).toHaveBeenCalledWith([item.ventaId], now.toISOString());
    deps.loadItems.mockResolvedValue([{ ...item, reason: 'declined' }]);
    expect(await declineSelected({ selection }, deps)).toBe(false);
    expect(deps.notifyAdmins).toHaveBeenCalledTimes(1);
  });
  it('keeps declines successful when push delivery fails', async () => {
    const deps = fixture(); deps.notifyAdmins.mockRejectedValue(new Error('push failed'));
    const selection = await applySelection({ selection: await startRenewalSelection(input, deps), action: { type: 'decline', ventaId: item.ventaId } }, deps);
    expect(await declineSelected({ selection }, deps)).toBe(true);
  });
});
