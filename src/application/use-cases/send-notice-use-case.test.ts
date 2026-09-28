import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoticeVenta } from '@/modules/messaging/message-data';
import type { NoticeRecord, NoticeStore } from '@/modules/messaging/notice-store';
import type { TemplateCatalog } from '@/modules/whatsapp/template-catalog';
import { sendNotice, type SendNoticeDeps } from './send-notice-use-case';

const NOW = new Date('2026-09-28T14:00:00Z');
const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const NOTICE_ID = '33333333-3333-4333-8333-333333333333';
function venta(overrides: Partial<NoticeVenta> = {}): NoticeVenta {
  return {
    ventaId: ID, clienteId: ID, clienteNombre: 'Ana Perez', telefono: '6000-0000',
    categoriaNombre: 'Netflix', servicioNombre: 'Netflix A', perfilNombre: 'Ana',
    correo: 'private@example.com', contrasena: 'secret', codigo: '1234',
    fechaVencimiento: new Date('2026-09-28T12:00:00'), monto: 10, moneda: 'USD',
    activa: true, reembolsada: false, enReposo: false, promesaPagoHasta: null, respuestaCliente: null,
    ...overrides,
  };
}
function record(key: string, status = 'pending'): NoticeRecord {
  return { id: NOTICE_ID, dedupe_key: key, tipo: 'dia_pago', tercero_id: ID,
    wa_id: '50760000000', channel: 'template', meta_template_name: 'aviso_vence_hoy',
    fecha_vencimiento: '2026-09-28', origin: 'manual', status, skip_reason: null,
    idempotency_key: key, outbound_message_id: null, wa_message_id: null, created_by: ID,
    created_at: '2026-09-28T13:00:00Z', updated_at: '2026-09-28T13:00:00Z' };
}
let sales: NoticeVenta[];
let store: NoticeStore;
let catalog: TemplateCatalog;
let send: SendNoticeDeps['send'];
beforeEach(() => {
  sales = [venta()];
  store = {
    loadVentas: vi.fn(async () => sales), loadTemplate: vi.fn(async () => ({
      contenido: 'Hola {cliente}: {servicio}', metaTemplateName: 'aviso_vence_hoy',
      metaParamMap: ['saludo_nombre', 'servicios', 'vencimiento', 'monto_total'],
    })),
    isAmbiguousPhone: vi.fn(async () => false), lastInboundAt: vi.fn(async () => null),
    reserve: vi.fn(async (input) => record(input.idempotencyKey)), finish: vi.fn(async () => undefined),
  };
  catalog = { getApproved: vi.fn(async () => ({ paramCount: 4,
    buttons: [{ type: 'QUICK_REPLY', text: 'Quiero renovar' }, { type: 'QUICK_REPLY', text: 'No deseo continuar' }] })) };
  send = vi.fn(async () => ({ id: ID2, sendStatus: 'accepted' as const, waMessageId: 'wamid.1', errorTitle: null, replayed: false }));
});
const input = { tipo: 'dia_pago' as const, ventaIds: [ID], origin: 'manual' as const, sentBy: ID, now: NOW };

describe('sendNotice', () => {
  it('groups matching sales and sends one approved template with ordered notice buttons', async () => {
    sales.push(venta({ ventaId: ID2, categoriaNombre: 'Disney+' }));
    const results = await sendNotice({ ...input, ventaIds: [ID, ID2] }, { store, catalog, send });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ noticeId: NOTICE_ID, ventaIds: [ID2, ID], status: 'accepted', channel: 'template', waId: '50760000000' });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({
      kind: 'template', buttonPayloads: [`RENOVAR:${NOTICE_ID}`, `NO_CONTINUAR:${NOTICE_ID}`],
    }) }));
    expect(store.finish).toHaveBeenCalledWith(NOTICE_ID, 'accepted', ID2, 'wamid.1');
  });
  it('skips ineligible and ambiguous phones without sending', async () => {
    sales = [venta({ enReposo: true }), venta({ ventaId: ID2, telefono: '6000-0001' })];
    vi.mocked(store.isAmbiguousPhone).mockResolvedValue(true);
    const results = await sendNotice({ ...input, ventaIds: [ID, ID2] }, { store, catalog, send });
    expect(results.map((result) => result.error)).toEqual(['en_reposo', 'telefono_ambiguo']);
    expect(send).not.toHaveBeenCalled();
    expect(store.finish).toHaveBeenCalledWith(NOTICE_ID, 'skipped', null, null, 'en_reposo');
    expect(store.finish).toHaveBeenCalledWith(NOTICE_ID, 'skipped', null, null, 'telefono_ambiguo');
  });
  it('records an invalid phone and a missing editor template as skipped notices', async () => {
    sales = [venta({ telefono: 'bad' })];
    expect((await sendNotice(input, { store, catalog, send }))[0]).toMatchObject({
      noticeId: NOTICE_ID, status: 'skipped', error: 'telefono_invalido',
    });
    sales = [venta()];
    vi.mocked(store.loadTemplate).mockResolvedValue(null);
    expect((await sendNotice(input, { store, catalog, send }))[0]).toMatchObject({
      noticeId: NOTICE_ID, status: 'skipped', error: 'plantilla_no_configurada',
    });
    expect(send).not.toHaveBeenCalled();
  });
  it('uses the Panama calendar date for payment promises near UTC midnight', async () => {
    sales = [venta({ promesaPagoHasta: new Date('2026-09-28T12:00:00') })];
    const results = await sendNotice({ ...input, now: new Date('2026-09-29T02:00:00Z') }, { store, catalog, send });
    expect(results[0]).toMatchObject({ status: 'skipped', error: 'promesa_pago' });
    expect(send).not.toHaveBeenCalled();
  });
  it('returns wa_me for an unapproved template or a closed free-text window', async () => {
    vi.mocked(catalog.getApproved).mockResolvedValue(null);
    expect((await sendNotice(input, { store, catalog, send }))[0]).toMatchObject({ status: 'wa_me', channel: 'wa_me', waMeText: 'Hola Ana Perez: Netflix A' });
    expect((await sendNotice({ ...input, tipo: 'renovacion' }, { store, catalog, send }))[0]).toMatchObject({ status: 'wa_me', channel: 'wa_me' });
    expect(store.reserve).not.toHaveBeenCalled();
  });
  it('sends free text when the 24-hour window is open', async () => {
    vi.mocked(store.lastInboundAt).mockResolvedValue('2026-09-28T13:00:00Z');
    const result = await sendNotice({ ...input, tipo: 'renovacion' }, { store, catalog, send });
    expect(result[0].status).toBe('accepted');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ payload: { kind: 'text', text: 'Hola Ana Perez: Netflix A' } }));
  });
  it.each([['accepted', 'already_sent'], ['pending', 'uncertain'], ['failed', 'failed']])('does not resend an existing %s notice', async (existing, expected) => {
    vi.mocked(store.reserve).mockImplementation(async () => record(ID2, existing));
    const result = await sendNotice(input, { store, catalog, send });
    expect(result[0].status).toBe(expected);
    expect(send).not.toHaveBeenCalled();
  });
  it('labels a pending notice older than ten minutes as possibly sent', async () => {
    vi.mocked(store.reserve).mockResolvedValue(record(ID2));
    expect((await sendNotice(input, { store, catalog, send }))[0]).toMatchObject({
      status: 'uncertain', error: 'pending_may_be_sent',
    });
  });
  it('leaves a thrown send uncertain because Meta may already have accepted it', async () => {
    vi.mocked(send).mockRejectedValue(new Error('Meta unavailable'));
    const result = await sendNotice(input, { store, catalog, send });
    expect(result[0]).toMatchObject({ status: 'uncertain', channel: 'template', waMeText: 'Hola Ana Perez: Netflix A' });
    expect(store.finish).not.toHaveBeenCalled();
  });
  it('records a confirmed Cloud API failure for manual retry', async () => {
    vi.mocked(send).mockResolvedValue({ id: ID2, sendStatus: 'failed', waMessageId: null, errorTitle: 'Failure', replayed: false });
    const result = await sendNotice(input, { store, catalog, send });
    expect(result[0]).toMatchObject({ status: 'failed', channel: 'template', waMeText: 'Hola Ana Perez: Netflix A' });
    expect(store.finish).toHaveBeenCalledWith(NOTICE_ID, 'failed', ID2, null);
  });
});
