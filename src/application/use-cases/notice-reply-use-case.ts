import { randomUUID } from 'node:crypto';

import { buildMessageData, renderFreeText, type NoticeGroup } from '@/modules/messaging/message-data';
import type { NoticeStore } from '@/modules/messaging/notice-store';
import type { NoticeReplyAction, NoticeReplyStore } from '@/modules/messaging/notice-reply-store';
import type { NewOutboundMessage, OutboundResult } from '@/modules/whatsapp/outbound-messages';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import { notifyAdminsAboutNotices } from '@/modules/notifications/admin-notice-push';
import { createLogger } from '@/platform/observability/logger';
import { isUuid } from '@/platform/utils/safety';

const MAX_NOTICE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CREDENTIALS_REDACTION = '[Credenciales enviadas]';
const log = createLogger('NoticeReply');

export type NoticeReplyDeps = {
  replies: NoticeReplyStore;
  notices: Pick<NoticeStore, 'loadVentas' | 'loadTemplate'>;
  send: (message: NewOutboundMessage) => Promise<OutboundResult>;
  notifyAdmins?: (body: string) => Promise<void>;
  now?: () => Date;
};

function actionFrom(message: InboundMessage): { action: NoticeReplyAction; noticeId: string } | null {
  if (message.messageType !== 'button' || !message.payload || typeof message.payload !== 'object'
    || Array.isArray(message.payload) || message.payload.type !== 'template_button'
    || typeof message.payload.payload !== 'string') return null;
  const match = /^(RENOVAR|NO_CONTINUAR|DATOS):([0-9a-fA-F-]{36})$/.exec(message.payload.payload);
  if (!match || !isUuid(match[2])) return null;
  const action = match[1];
  if (action !== 'RENOVAR' && action !== 'NO_CONTINUAR' && action !== 'DATOS') return null;
  return { action, noticeId: match[2] };
}

function allowed(action: NoticeReplyAction, tipo: string): boolean {
  if (action === 'DATOS') return tipo === 'actualizacion_credenciales' || tipo === 'transferencia_servicio';
  if (action === 'NO_CONTINUAR') return tipo === 'notificacion_regular' || tipo === 'dia_pago';
  return tipo === 'notificacion_regular' || tipo === 'dia_pago' || tipo === 'cancelacion';
}

export async function handleNoticeReply(message: InboundMessage, deps: NoticeReplyDeps): Promise<'ignored' | 'duplicate' | 'accepted' | 'failed'> {
  const parsed = actionFrom(message);
  if (!parsed) return 'ignored';
  const { action, noticeId } = parsed;
  const notice = await deps.replies.findNotice(noticeId);
  const now = (deps.now ?? (() => new Date()))();
  if (!notice || notice.status !== 'accepted' || notice.wa_id !== message.fromWaId
    || (message.contextWaMessageId !== null && message.contextWaMessageId !== notice.wa_message_id)
    || !allowed(action, notice.tipo)) return 'ignored';
  const age = now.getTime() - new Date(notice.created_at).getTime();
  if (!Number.isFinite(age) || age < 0 || age > MAX_NOTICE_AGE_MS) return 'ignored';
  if (!await deps.replies.claim(noticeId, action, message.waMessageId)) return 'duplicate';

  try {
    const ventaIds = await deps.replies.ventaIds(noticeId);
    if (ventaIds.length === 0) throw new Error('Notice has no sales');
    const ventas = await deps.notices.loadVentas(ventaIds);
    if (ventas.length !== ventaIds.length || ventas.some((venta) => venta.clienteId !== notice.tercero_id)) {
      throw new Error('Notice sales no longer match');
    }
    const group: NoticeGroup = {
      clienteId: notice.tercero_id,
      clienteNombre: ventas[0].clienteNombre,
      telefono: ventas[0].telefono,
      fechaVencimiento: ventas[0].fechaVencimiento,
      moneda: ventas[0].moneda,
      ventas,
    };
    const tipo = action === 'RENOVAR' ? 'datos_pago'
      : action === 'NO_CONTINUAR' ? 'despedida' : notice.tipo;
    const template = await deps.notices.loadTemplate(tipo);
    if (!template?.contenido) throw new Error('Notice reply template is unavailable');
    const rendered = renderFreeText(template.contenido, buildMessageData(group, { now }));
    if (!rendered || rendered.length > 4096) throw new Error('Notice reply text is invalid');
    if (action === 'NO_CONTINUAR') {
      await deps.replies.declineVentas(ventaIds, now.toISOString());
      const services = [...new Set(ventas.map((venta) => venta.categoriaNombre || venta.servicioNombre).filter(Boolean))].join(', ');
      try {
        await (deps.notifyAdmins ?? notifyAdminsAboutNotices)(`${group.clienteNombre} no desea continuar con ${services}`);
      } catch (error) {
        log.warn('NO_CONTINUAR admin push failed', { error });
      }
    }
    const result = await deps.send({
      idempotencyKey: randomUUID(), toWaId: notice.wa_id,
      payload: { kind: 'text', text: rendered, replyTo: message.waMessageId },
      sentBy: null,
      ...(action === 'DATOS' ? { storedTextBody: CREDENTIALS_REDACTION } : {}),
    });
    if (result.sendStatus !== 'accepted') throw new Error('Notice reply send was not accepted');
    await deps.replies.finish(noticeId, action, 'accepted');
    return 'accepted';
  } catch {
    await deps.replies.finish(noticeId, action, 'failed');
    return 'failed';
  }
}
