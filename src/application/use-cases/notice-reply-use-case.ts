import { createHash } from 'node:crypto';

import { buildMessageData, maskCredentials, renderFreeText, type NoticeGroup } from '@/modules/messaging/message-data';
import type { NoticeStore } from '@/modules/messaging/notice-store';
import type { NoticeReplyAction, NoticeReplyStore } from '@/modules/messaging/notice-reply-store';
import type { NewOutboundMessage, OutboundResult } from '@/modules/whatsapp/outbound-messages';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import { notifyAdminsAboutNotices } from '@/modules/notifications/admin-notice-push';
import { createLogger } from '@/platform/observability/logger';
import { isUuid } from '@/platform/utils/safety';

const MAX_NOTICE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
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

export type NoticeReplyResult = 'ignored' | 'duplicate' | 'busy' | 'exhausted' | 'uncertain' | 'accepted' | 'failed';

function replyKey(id: number): string {
  const hex = createHash('sha256').update(`notice-reply:${id}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function handleNoticeReply(message: InboundMessage, deps: NoticeReplyDeps, retry = false): Promise<NoticeReplyResult> {
  const parsed = actionFrom(message);
  if (!parsed) return 'ignored';
  const { action, noticeId } = parsed;
  const notice = await deps.replies.findNotice(noticeId);
  const now = deps.now?.() ?? new Date();
  if (!notice || notice.status !== 'accepted' || notice.wa_id !== message.fromWaId
    || (message.contextWaMessageId !== null && message.contextWaMessageId !== notice.wa_message_id)
    || !allowed(action, notice.tipo)) return 'ignored';
  const age = now.getTime() - new Date(notice.created_at).getTime();
  if (!Number.isFinite(age) || age < 0 || (!retry && age > MAX_NOTICE_AGE_MS)) return 'ignored';
  const claim = await deps.replies.claim(noticeId, action, message.waMessageId);
  if (claim.outcome !== 'claimed') return claim.outcome;

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
      : action === 'NO_CONTINUAR' ? 'despedida' : 'datos_acceso';
    const template = await deps.notices.loadTemplate(tipo);
    if (!template?.contenido) throw new Error('Notice reply template is unavailable');
    const data = buildMessageData(group, { now });
    const rendered = renderFreeText(template.contenido, data);
    if (!rendered || rendered.length > 4096) throw new Error('Notice reply text is invalid');
    if (action === 'NO_CONTINUAR') {
      const changed = await deps.replies.declineVentas(ventaIds, now.toISOString());
      const services = [...new Set(ventas.map((venta) => venta.categoriaNombre || venta.servicioNombre).filter(Boolean))].join(', ');
      if (changed) {
        try {
          await (deps.notifyAdmins ?? notifyAdminsAboutNotices)(`${group.clienteNombre} no desea continuar con ${services}`);
        } catch (error) {
          log.warn('NO_CONTINUAR admin push failed', { error });
        }
      }
    }
    let result: OutboundResult;
    try {
      result = await deps.send({
      idempotencyKey: replyKey(claim.id), toWaId: notice.wa_id,
      payload: { kind: 'text', text: rendered, replyTo: message.waMessageId },
      sentBy: null,
      // El cliente recibe el texto real; el chat guarda el mismo texto con contrasena y PIN ocultos.
      ...(action === 'DATOS' ? { storedTextBody: renderFreeText(template.contenido, maskCredentials(data)) } : {}),
      });
    } catch {
      await deps.replies.finish(claim.id, claim.attempts, 'uncertain', 'SEND_EXCEPTION');
      return 'uncertain';
    }
    if (result.sendStatus === 'pending') {
      await deps.replies.finish(claim.id, claim.attempts, 'uncertain', 'SEND_PENDING');
      return 'uncertain';
    }
    if (result.sendStatus === 'failed') {
      await deps.replies.finish(claim.id, claim.attempts, 'failed', 'SEND_REJECTED');
      return 'failed';
    }
    await deps.replies.finish(claim.id, claim.attempts, 'accepted');
    return 'accepted';
  } catch {
    await deps.replies.finish(claim.id, claim.attempts, 'failed', 'PREPARE_FAILED');
    return 'failed';
  }
}

export async function retryPendingNoticeReplies(deps: NoticeReplyDeps, limit: number) {
  const messages = await deps.replies.listRetryable(limit);
  const results = { processed: 0, accepted: 0, failed: 0, uncertain: 0, skipped: 0 };
  for (const message of messages) {
    results.processed++;
    try {
      const result = await handleNoticeReply(message, deps, true);
      if (result === 'accepted' || result === 'failed' || result === 'uncertain') results[result]++;
      else results.skipped++;
    } catch {
      log.warn('Notice reply retry could not be processed');
      results.skipped++;
    }
  }
  return results;
}
