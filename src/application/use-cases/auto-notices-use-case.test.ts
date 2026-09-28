import { describe, expect, it, vi } from 'vitest';
import type { AutoNoticeStore } from '@/modules/messaging/auto-notice-store';
import type { NoticeVenta } from '@/modules/messaging/message-data';
import type { NoticeStore } from '@/modules/messaging/notice-store';
import { panamaDateHour, runAutoNotices } from './auto-notices-use-case';

const NOW = new Date('2026-09-28T14:05:00Z');
const venta = (id: string, client: string, phone: string): NoticeVenta => ({
  ventaId: id, clienteId: client, clienteNombre: 'Cliente Ejemplo', telefono: phone,
  categoriaNombre: 'Netflix', servicioNombre: 'Netflix', perfilNombre: 'Perfil',
  correo: '', contrasena: '', codigo: '', fechaVencimiento: new Date('2026-09-28T12:00:00'),
  monto: 5, moneda: 'USD', activa: true, reembolsada: false, enReposo: false,
  promesaPagoHasta: null, respuestaCliente: null,
});

function fixture() {
  const sales = [venta('sale-1', 'client-1', '60000001'), venta('sale-2', 'client-2', '60000002')];
  const runs = {
    config: vi.fn().mockResolvedValue({ enabled: true, sendHour: 9, dailyCap: 200 }),
    claim: vi.fn().mockResolvedValue('run-1'),
    ventaIdsDue: vi.fn().mockResolvedValue(sales.map((sale) => sale.ventaId)),
    acceptedWaIds: vi.fn().mockResolvedValue(new Set<string>()),
    finish: vi.fn().mockResolvedValue(undefined),
  } satisfies AutoNoticeStore;
  const store = {
    loadVentas: vi.fn().mockImplementation(async (ids: string[]) => sales.filter((sale) => ids.includes(sale.ventaId))),
    loadTemplate: vi.fn().mockResolvedValue({ contenido: 'Hola {cliente}', metaTemplateName: 'aviso_vence_hoy', metaParamMap: [] }),
    isAmbiguousPhone: vi.fn().mockResolvedValue(false),
    lastInboundAt: vi.fn().mockResolvedValue(null),
    reserve: vi.fn().mockImplementation(async (input: { idempotencyKey: string }) => ({
      id: '123e4567-e89b-12d3-a456-426614174000', idempotency_key: input.idempotencyKey,
      status: 'pending', created_at: NOW.toISOString(),
    })),
    finish: vi.fn().mockResolvedValue(undefined),
  } satisfies NoticeStore;
  const catalog = { getApproved: vi.fn().mockResolvedValue({ paramCount: 0, buttons: [] }) };
  const send = vi.fn().mockResolvedValue({ id: 'out-1', sendStatus: 'accepted', waMessageId: 'wamid.1', errorTitle: null, replayed: false });
  const syncTemplates = vi.fn().mockResolvedValue(1);
  const notifyAdmins = vi.fn().mockResolvedValue(undefined);
  return { runs, notices: { store, catalog, send }, syncTemplates, notifyAdmins, now: () => NOW };
}

describe('runAutoNotices', () => {
  it('uses the Panama date and hour across UTC midnight', () => {
    expect(panamaDateHour(new Date('2026-09-29T02:00:00Z'))).toEqual({ date: '2026-09-28', hour: 21 });
    expect(panamaDateHour(NOW)).toEqual({ date: '2026-09-28', hour: 9 });
  });

  it('does not claim when disabled or outside the configured hour', async () => {
    const deps = fixture();
    deps.runs.config.mockResolvedValueOnce({ enabled: false, sendHour: 9, dailyCap: 200 });
    expect(await runAutoNotices(deps)).toEqual({ skipped: 'not_scheduled' });
    deps.runs.config.mockResolvedValueOnce({ enabled: true, sendHour: 10, dailyCap: 200 });
    expect(await runAutoNotices(deps)).toEqual({ skipped: 'not_scheduled' });
    expect(deps.runs.claim).not.toHaveBeenCalled();
  });

  it('claims the Panama date once and sends no duplicates', async () => {
    const deps = fixture();
    deps.runs.claim.mockResolvedValueOnce(null);
    expect(await runAutoNotices(deps)).toEqual({ skipped: 'already_ran' });
    expect(deps.runs.claim).toHaveBeenCalledWith('2026-09-28');
    expect(deps.notices.send).not.toHaveBeenCalled();
  });

  it('respects the rolling recipient cap and records remaining groups', async () => {
    const deps = fixture();
    deps.runs.config.mockResolvedValue({ enabled: true, sendHour: 9, dailyCap: 2 });
    deps.runs.acceptedWaIds.mockResolvedValue(new Set(['50769999999']));
    expect(await runAutoNotices(deps)).toEqual({ status: 'done', sent: 1, failed: 0, skipped: 1, already_sent: 0 });
    expect(deps.runs.acceptedWaIds).toHaveBeenCalledWith('2026-09-27T14:05:00.000Z');
    expect(deps.notices.send).toHaveBeenCalledTimes(1);
    expect(deps.notices.send).toHaveBeenCalledWith(expect.objectContaining({ sentBy: null }));
    expect(deps.runs.finish).toHaveBeenCalledWith('run-1', 'done', expect.any(Object),
      { reasons: { limite_diario: 1 }, templateSyncFailed: false,
        omitted: [{ reason: 'limite_diario', venta_ids: ['sale-2'], wa_id_suffix: '0002' }] });
    expect(deps.notifyAdmins).toHaveBeenCalledWith(expect.stringContaining('1 omitidos'));
  });

  it('limits each concurrent batch to the remaining cap', async () => {
    const deps = fixture();
    const sales = [venta('sale-1', 'client-1', '60000001'), venta('sale-2', 'client-2', '60000002'),
      venta('sale-3', 'client-3', '60000003')];
    deps.runs.config.mockResolvedValue({ enabled: true, sendHour: 9, dailyCap: 2 });
    deps.runs.ventaIdsDue.mockResolvedValue(sales.map((sale) => sale.ventaId));
    deps.notices.store.loadVentas.mockImplementation(async (ids: string[]) =>
      sales.filter((sale) => ids.includes(sale.ventaId)));
    expect(await runAutoNotices(deps)).toEqual({ status: 'done', sent: 2, failed: 0, skipped: 1, already_sent: 0 });
    expect(deps.notices.send).toHaveBeenCalledTimes(2);
  });

  it('skips unapproved templates without opening wa.me or sending', async () => {
    const deps = fixture();
    deps.notices.catalog.getApproved.mockResolvedValue(null);
    expect(await runAutoNotices(deps)).toEqual({ status: 'done', sent: 0, failed: 0, skipped: 2, already_sent: 0 });
    expect(deps.notices.send).not.toHaveBeenCalled();
    expect(deps.runs.finish).toHaveBeenCalledWith('run-1', 'done', expect.any(Object),
      { reasons: { plantilla_no_aprobada: 2 }, templateSyncFailed: false, omitted: [
        { reason: 'plantilla_no_aprobada', venta_ids: ['sale-1'], wa_id_suffix: '0001' },
        { reason: 'plantilla_no_aprobada', venta_ids: ['sale-2'], wa_id_suffix: '0002' },
      ] });
  });

  it('continues with cached templates after synchronization fails', async () => {
    const deps = fixture();
    deps.syncTemplates.mockRejectedValue(new Error('Meta unavailable'));
    expect(await runAutoNotices(deps)).toEqual({ status: 'done', sent: 2, failed: 0, skipped: 0, already_sent: 0 });
    expect(deps.runs.finish).toHaveBeenCalledWith('run-1', 'done', expect.any(Object),
      { reasons: {}, templateSyncFailed: true, omitted: [] });
    expect(deps.notifyAdmins).not.toHaveBeenCalled();
  });

  it('excludes NO_CONTINUAR and out-of-date sales before sending', async () => {
    const deps = fixture();
    const declined = { ...venta('sale-3', 'client-3', '60000003'), respuestaCliente: 'no_continuar' as const };
    const tomorrow = { ...venta('sale-4', 'client-4', '60000004'), fechaVencimiento: new Date('2026-09-29T12:00:00') };
    deps.runs.ventaIdsDue.mockResolvedValue(['sale-1', 'sale-3', 'sale-4']);
    const sales = [venta('sale-1', 'client-1', '60000001'), declined, tomorrow];
    deps.notices.store.loadVentas.mockImplementation(async (ids: string[]) =>
      sales.filter((sale) => ids.includes(sale.ventaId)));
    expect(await runAutoNotices(deps)).toEqual({ status: 'done', sent: 1, failed: 0, skipped: 0, already_sent: 0 });
    expect(deps.notices.send).toHaveBeenCalledTimes(1);
  });

  it('marks a failed run and alerts admins when loading due sales fails', async () => {
    const deps = fixture();
    deps.runs.ventaIdsDue.mockRejectedValue(new Error('read failed'));
    expect(await runAutoNotices(deps)).toEqual({ status: 'failed', sent: 0, failed: 1, skipped: 0, already_sent: 0 });
    expect(deps.runs.finish).toHaveBeenCalledWith('run-1', 'failed', expect.any(Object),
      { reasons: { error_corrida: 1 }, templateSyncFailed: false, omitted: [] });
    expect(deps.notifyAdmins).toHaveBeenCalledTimes(1);
  });
});
