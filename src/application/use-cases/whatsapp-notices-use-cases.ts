import { postWhatsAppNotices, type NoticeResult, type NoticeTipo } from '@/platform/api/whatsapp-notices-client';
import { getCurrentSession } from '@/platform/supabase/auth';
import {
  listVentaNoticeStatusRows,
  listVentaRespuestaRows,
} from '@/platform/supabase/whatsapp-notices-repository';

export type NoticeBadgeStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type VentaNoticeState = {
  noticeId: string | null;
  tipo: string | null;
  badge: NoticeBadgeStatus | null;
  createdAt: string | null;
  noContinuar: boolean;
  noContinuarAt: string | null;
};

/** Estado visible del aviso: manda el estado real de entrega del webhook sobre el del envio. */
export function mapNoticeBadge(noticeStatus: string | null, deliveryStatus: string | null): NoticeBadgeStatus | null {
  if (!noticeStatus) return null;
  if (deliveryStatus === 'failed' || noticeStatus === 'failed') return 'failed';
  if (deliveryStatus === 'read') return 'read';
  if (deliveryStatus === 'delivered') return 'delivered';
  if (deliveryStatus === 'sent') return 'sent';
  if (noticeStatus === 'accepted') return 'sent';
  if (noticeStatus === 'pending' || noticeStatus === 'uncertain') return 'pending';
  return null;
}

export async function getVentaNoticeStatusUseCase(ventaIds: string[]): Promise<Record<string, VentaNoticeState>> {
  const [notices, respuestas] = await Promise.all([
    listVentaNoticeStatusRows(ventaIds),
    listVentaRespuestaRows(ventaIds),
  ]);
  const states: Record<string, VentaNoticeState> = {};
  const empty = (): VentaNoticeState => ({
    noticeId: null, tipo: null, badge: null, createdAt: null, noContinuar: false, noContinuarAt: null,
  });
  for (const row of notices) {
    if (!row.venta_id) continue;
    states[row.venta_id] = {
      ...(states[row.venta_id] ?? empty()),
      noticeId: row.notice_id,
      tipo: row.tipo,
      badge: mapNoticeBadge(row.notice_status, row.delivery_status),
      createdAt: row.created_at,
    };
  }
  for (const row of respuestas) {
    if (row.respuesta_cliente !== 'no_continuar') continue;
    states[row.id] = {
      ...(states[row.id] ?? empty()),
      noContinuar: true,
      noContinuarAt: row.respuesta_cliente_at,
    };
  }
  return states;
}

export async function sendWhatsAppNoticesUseCase(
  input: { tipo: NoticeTipo; ventaIds: string[]; eventId?: string },
): Promise<NoticeResult[]> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('No hay una sesión activa para enviar avisos por WhatsApp.');
  const { results } = await postWhatsAppNotices(session.access_token, input);
  return results;
}

export function isNoticeDelivered(status: NoticeResult['status']): boolean {
  return status === 'accepted' || status === 'already_sent';
}

export type AutomaticRenewalOutcome = 'auto_disabled' | 'sent' | 'not_sent';

/**
 * Confirma la renovacion por la API solo si el WhatsApp automatico esta encendido: el servidor decide entre
 * texto libre (ventana de 24 h abierta) y plantilla de Meta. `auto_disabled` deja la eleccion a quien renovo.
 */
export async function sendAutomaticRenewalNoticeUseCase(ventaId: string): Promise<AutomaticRenewalOutcome> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('No hay una sesión activa para enviar avisos por WhatsApp.');
  const { results, skipped } = await postWhatsAppNotices(session.access_token, { tipo: 'renovacion', ventaIds: [ventaId], automatic: true });
  if (skipped) return 'auto_disabled';
  return results.some((result) => isNoticeDelivered(result.status)) ? 'sent' : 'not_sent';
}
