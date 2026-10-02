import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NoticeVenta } from '@/modules/messaging/message-data';
import type { NoticeRecord, NoticeStore } from '@/modules/messaging/notice-store';
import type { NoticeReplyStore } from '@/modules/messaging/notice-reply-store';
import type { OutboundResult } from '@/modules/whatsapp/outbound-messages';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import { handleNoticeReply, retryPendingNoticeReplies, type NoticeReplyDeps } from './notice-reply-use-case';

const ID = '123e4567-e89b-12d3-a456-426614174000';
const NOW = new Date('2026-09-28T16:00:00Z');

const notice: NoticeRecord = {
  id: ID, dedupe_key: 'notice', tipo: 'notificacion_regular', tercero_id: 'client-1',
  wa_id: '50760000000', channel: 'template', meta_template_name: 'aviso_vencimiento',
  fecha_vencimiento: '2026-09-30', origin: 'manual', status: 'accepted', skip_reason: null,
  idempotency_key: ID, outbound_message_id: ID, wa_message_id: 'wamid.NOTICE',
  created_by: null, created_at: '2026-09-27T16:00:00Z', updated_at: '2026-09-27T16:00:00Z',
};
const venta: NoticeVenta = {
  ventaId: 'sale-1', clienteId: 'client-1', clienteNombre: 'Cliente Ejemplo', telefono: '60000000',
  categoriaNombre: 'Servicio', servicioNombre: 'Servicio', perfilNombre: 'Perfil 1',
  correo: 'cuenta@example.test', contrasena: 'clave-vigente-del-test', codigo: '1234',
  fechaVencimiento: new Date('2026-09-30T12:00:00'), monto: 5, moneda: 'USD',
  activa: true, reembolsada: false, enReposo: false, promesaPagoHasta: null, respuestaCliente: null,
};
const inbound: InboundMessage = {
  waMessageId: 'wamid.IN', phoneNumberId: '123456', fromWaId: notice.wa_id,
  contactName: null, messageType: 'button', textBody: 'Quiero renovar',
  sentAt: NOW.toISOString(), mediaId: null, mediaMimeType: null, mediaFilename: null,
  contextWaMessageId: 'wamid.NOTICE', reactionEmoji: null,
  payload: { type: 'template_button', text: 'Quiero renovar', payload: `RENOVAR:${ID}` },
};
const accepted: OutboundResult = {
  id: ID, sendStatus: 'accepted', waMessageId: 'wamid.SENT', errorTitle: null, replayed: false,
};

function fixture() {
  const replies = {
    findNotice: vi.fn().mockResolvedValue(notice),
    ventaIds: vi.fn().mockResolvedValue(['sale-1']),
    claim: vi.fn().mockResolvedValue({ id: 42, attempts: 1, outcome: 'claimed' }),
    declineVentas: vi.fn().mockResolvedValue(true),
    finish: vi.fn().mockResolvedValue(true),
    listRetryable: vi.fn().mockResolvedValue([]),
  } satisfies NoticeReplyStore;
  const notices = {
    loadVentas: vi.fn().mockResolvedValue([venta]),
    loadTemplate: vi.fn().mockResolvedValue({ contenido: 'Hola {cliente}: {correo} / {contrasena} / {codigo}', metaTemplateName: null, metaParamMap: [] }),
  } satisfies Pick<NoticeStore, 'loadVentas' | 'loadTemplate'>;
  const send = vi.fn().mockResolvedValue(accepted);
  const notifyAdmins = vi.fn().mockResolvedValue(undefined);
  return { replies, notices, send, notifyAdmins, now: () => NOW } satisfies NoticeReplyDeps;
}

describe('handleNoticeReply', () => {
  beforeEach(() => vi.restoreAllMocks());

  it.each(['OTHER:123e4567-e89b-12d3-a456-426614174000', 'RENOVAR:bad', 'RENOVAR:'])
  ('ignores unknown or invalid button payloads', async (payload) => {
    const deps = fixture();
    expect(await handleNoticeReply({ ...inbound, payload: { type: 'template_button', payload } }, deps)).toBe('ignored');
    expect(deps.replies.findNotice).not.toHaveBeenCalled();
  });

  it.each([
    ['missing notice', null, inbound],
    ['wrong sender', notice, { ...inbound, fromWaId: '50769999999' }],
    ['wrong context', notice, { ...inbound, contextWaMessageId: 'wamid.OTHER' }],
    ['failed notice', { ...notice, status: 'failed' }, inbound],
    ['expired notice', { ...notice, created_at: '2026-08-20T16:00:00Z' }, inbound],
  ])('ignores %s', async (_label, record, message) => {
    const deps = fixture();
    deps.replies.findNotice.mockResolvedValue(record);
    expect(await handleNoticeReply(message, deps)).toBe('ignored');
    expect(deps.replies.claim).not.toHaveBeenCalled();
  });

  it('accepts a matching sender when Meta omits context and sends payment details', async () => {
    const deps = fixture();
    expect(await handleNoticeReply({ ...inbound, contextWaMessageId: null }, deps)).toBe('accepted');
    expect(deps.notices.loadTemplate).toHaveBeenCalledWith('datos_pago');
    expect(deps.send).toHaveBeenCalledWith(expect.objectContaining({
      sentBy: null, toWaId: notice.wa_id, payload: expect.objectContaining({ kind: 'text' }),
    }));
    expect(deps.replies.finish).toHaveBeenCalledWith(42, 1, 'accepted');
  });

  it('uses the sender when context and the notice message ID are both absent', async () => {
    const deps = fixture();
    deps.replies.findNotice.mockResolvedValue({ ...notice, wa_message_id: null });
    expect(await handleNoticeReply({ ...inbound, contextWaMessageId: null }, deps)).toBe('accepted');
  });

  it('does nothing on a duplicate tap', async () => {
    const deps = fixture();
    deps.replies.claim.mockResolvedValue({ id: 42, attempts: 1, outcome: 'duplicate' });
    expect(await handleNoticeReply(inbound, deps)).toBe('duplicate');
    expect(deps.notices.loadVentas).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('marks only linked sales and sends a farewell without cutting sales', async () => {
    const deps = fixture();
    const message = { ...inbound, payload: { type: 'template_button', payload: `NO_CONTINUAR:${ID}`, text: 'No deseo continuar' } };
    expect(await handleNoticeReply(message, deps)).toBe('accepted');
    expect(deps.replies.declineVentas).toHaveBeenCalledWith(['sale-1'], NOW.toISOString());
    expect(deps.notices.loadTemplate).toHaveBeenCalledWith('despedida');
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(deps.notifyAdmins).toHaveBeenCalledWith('Cliente Ejemplo no desea continuar con Servicio');
  });

  it('keeps NO_CONTINUAR accepted when admin push fails', async () => {
    const deps = fixture();
    deps.notifyAdmins.mockRejectedValue(new Error('push failed'));
    const message = { ...inbound, payload: { type: 'template_button', payload: `NO_CONTINUAR:${ID}` } };
    expect(await handleNoticeReply(message, deps)).toBe('accepted');
    expect(deps.replies.declineVentas).toHaveBeenCalledTimes(1);
  });

  it.each(['actualizacion_credenciales', 'transferencia_servicio'] as const)
  ('loads current credentials and stores a masked copy for %s', async (tipo) => {
    const deps = fixture();
    deps.replies.findNotice.mockResolvedValue({ ...notice, tipo });
    const message = { ...inbound, payload: { type: 'template_button', payload: `DATOS:${ID}`, text: 'Recibir mis datos' } };
    expect(await handleNoticeReply(message, deps)).toBe('accepted');
    expect(deps.notices.loadVentas).toHaveBeenCalledWith(['sale-1']);
    expect(deps.notices.loadTemplate).toHaveBeenCalledWith(tipo);
    expect(deps.send).toHaveBeenCalledWith(expect.objectContaining({
      // El cliente recibe la contraseña real; el chat guarda el mismo texto con contraseña y PIN ocultos.
      storedTextBody: 'Hola Cliente Ejemplo: cuenta@example.test / •••••••• / ••••••••',
      payload: expect.objectContaining({ text: expect.stringContaining(venta.contrasena) }),
    }));
    expect(deps.send.mock.calls[0]![0].storedTextBody).not.toContain(venta.contrasena);
  });

  it.each([
    ['2026-09-29T23:13:00Z', 'Buenas tardes'], // 6:13 pm en Panamá (en UTC ya serían las 23)
    ['2026-09-29T14:00:00Z', 'Buenos días'], // 9:00 am
    ['2026-09-30T01:30:00Z', 'Buenas noches'], // 8:30 pm
    ['2026-09-30T07:00:00Z', 'Buenas'], // 2:00 am
  ])('greets a reply sent at %s with Panama time: %s', async (instant, saludo) => {
    // vitest fija TZ=America/Panama; Vercel corre en UTC, que es donde salía "Buenas noches" a las 6:13 pm.
    const previous = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      const deps = { ...fixture(), now: () => new Date(instant) };
      deps.replies.findNotice.mockResolvedValue({ ...notice, tipo: 'actualizacion_credenciales', created_at: '2026-09-29T00:00:00Z' });
      deps.notices.loadTemplate.mockResolvedValue({ contenido: '{saludo}, {nombre_cliente}.', metaTemplateName: null, metaParamMap: [] });
      const message = { ...inbound, payload: { type: 'template_button', payload: `DATOS:${ID}`, text: 'Recibir mis datos' } };
      expect(await handleNoticeReply(message, deps)).toBe('accepted');
      expect(deps.send).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({ text: `${saludo}, Cliente.` }),
      }));
    } finally {
      if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
    }
  });

  it('records action failure without another send', async () => {
    const deps = fixture();
    deps.send.mockResolvedValue({ ...accepted, sendStatus: 'failed' });
    expect(await handleNoticeReply(inbound, deps)).toBe('failed');
    expect(deps.replies.finish).toHaveBeenCalledWith(42, 1, 'failed', 'SEND_REJECTED');
  });

  it('mantiene la misma clave al reintentar un rechazo confirmado', async () => {
    const deps = fixture();
    deps.send.mockResolvedValueOnce({ ...accepted, sendStatus: 'failed' }).mockResolvedValueOnce(accepted);
    expect(await handleNoticeReply(inbound, deps)).toBe('failed');
    deps.replies.claim.mockResolvedValue({ id: 42, attempts: 2, outcome: 'claimed' });
    expect(await handleNoticeReply(inbound, deps)).toBe('accepted');
    expect(deps.send.mock.calls[0]![0].idempotencyKey).toBe(deps.send.mock.calls[1]![0].idempotencyKey);
  });

  it('deja una excepcion de envio incierta y no vuelve a enviar', async () => {
    const deps = fixture();
    deps.send.mockRejectedValueOnce(new Error('timeout'));
    expect(await handleNoticeReply(inbound, deps)).toBe('uncertain');
    expect(deps.replies.finish).toHaveBeenCalledWith(42, 1, 'uncertain', 'SEND_EXCEPTION');
    deps.replies.claim.mockResolvedValue({ id: 42, attempts: 1, outcome: 'uncertain' });
    expect(await handleNoticeReply(inbound, deps)).toBe('uncertain');
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it.each(['busy', 'exhausted'] as const)('no procesa un claim %s', async (outcome) => {
    const deps = fixture();
    deps.replies.claim.mockResolvedValue({ id: 42, attempts: 5, outcome });
    expect(await handleNoticeReply(inbound, deps)).toBe(outcome);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('no repite el push de administradores si las ventas ya fueron marcadas', async () => {
    const deps = fixture();
    deps.replies.declineVentas.mockResolvedValue(false);
    const message = { ...inbound, payload: { type: 'template_button', payload: `NO_CONTINUAR:${ID}` } };
    expect(await handleNoticeReply(message, deps)).toBe('accepted');
    expect(deps.notifyAdmins).not.toHaveBeenCalled();
  });

  it('procesa un lote recuperado', async () => {
    const deps = fixture();
    deps.replies.listRetryable.mockResolvedValue([inbound]);
    expect(await retryPendingNoticeReplies(deps, 25)).toEqual({
      processed: 1, accepted: 1, failed: 0, uncertain: 0, skipped: 0,
    });
    expect(deps.replies.listRetryable).toHaveBeenCalledWith(25);
  });

  it.each(['no sales', 'mismatched sales', 'no template'] as const)
  ('registra un fallo preparatorio: %s', async (condition) => {
    const deps = fixture();
    if (condition === 'no sales') deps.replies.ventaIds.mockResolvedValue([]);
    if (condition === 'mismatched sales') deps.notices.loadVentas.mockResolvedValue([{ ...venta, clienteId: 'other' }]);
    if (condition === 'no template') deps.notices.loadTemplate.mockResolvedValue(null);
    expect(await handleNoticeReply(inbound, deps)).toBe('failed');
    expect(deps.replies.finish).toHaveBeenCalledWith(42, 1, 'failed', 'PREPARE_FAILED');
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('trata un resultado saliente pendiente como incierto', async () => {
    const deps = fixture();
    deps.send.mockResolvedValue({ ...accepted, sendStatus: 'pending' });
    expect(await handleNoticeReply(inbound, deps)).toBe('uncertain');
    expect(deps.replies.finish).toHaveBeenCalledWith(42, 1, 'uncertain', 'SEND_PENDING');
  });

  it('continua el lote cuando una fila falla antes del claim', async () => {
    const deps = fixture();
    deps.replies.listRetryable.mockResolvedValue([inbound, inbound]);
    deps.replies.findNotice.mockRejectedValueOnce(new Error('temporary'));
    expect(await retryPendingNoticeReplies(deps, 25)).toEqual({
      processed: 2, accepted: 1, failed: 0, uncertain: 0, skipped: 1,
    });
  });
});

it.each(['actualizacion_credenciales', 'transferencia_servicio'] as const)
('never sends a code-access password in DATOS replies for %s', async (tipo) => {
  const deps = fixture();
  deps.replies.findNotice.mockResolvedValue({ ...notice, tipo });
  deps.notices.loadVentas.mockResolvedValue([{ ...venta, accesoPorCodigo: true }]);
  const message = { ...inbound, payload: { type: 'template_button', payload: `DATOS:${ID}` } };
  expect(await handleNoticeReply(message, deps)).toBe('accepted');
  const sent = deps.send.mock.calls[0]![0];
  expect(sent.payload).toMatchObject({ text: expect.not.stringContaining(venta.contrasena) });
  expect(sent.storedTextBody).not.toContain(venta.contrasena);
});
