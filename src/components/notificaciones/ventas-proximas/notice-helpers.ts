import type { NoticeBadgeStatus, VentaNoticeState } from '@/application/use-cases/whatsapp-notices-use-cases';
import { buildMessageData, renderFreeText, type NoticeGroup, type NoticeVenta } from '@/modules/messaging/message-data';
import type { NoticeResult, NoticeTipo } from '@/platform/api/whatsapp-notices-client';

import type { NotificacionVentaConId } from './types';

export type RuleTipo = 'dia_pago';

/** Aviso de pago: un solo tipo ("Aviso de vencimiento") antes y el dia del vencimiento. */
export function noticeTipoFor(): RuleTipo {
  return 'dia_pago';
}

export function groupNotificationsByTipo(notifs: readonly NotificacionVentaConId[]): Array<{ tipo: RuleTipo; ventaIds: string[] }> {
  const groups = new Map<RuleTipo, string[]>();
  for (const notif of notifs) {
    const tipo = noticeTipoFor();
    groups.set(tipo, [...(groups.get(tipo) ?? []), notif.ventaId]);
  }
  return [...groups].map(([tipo, ventaIds]) => ({ tipo, ventaIds: [...new Set(ventaIds)] }));
}

function toNoticeVenta(notif: NotificacionVentaConId): NoticeVenta {
  return {
    ventaId: notif.ventaId,
    clienteId: notif.clienteId,
    clienteNombre: notif.clienteNombre,
    telefono: notif.clienteTelefono ?? '',
    categoriaNombre: notif.categoriaNombre,
    servicioNombre: notif.servicioNombre,
    perfilNombre: notif.perfilNombre ?? '',
    correo: notif.servicioCorreo ?? '',
    contrasena: notif.servicioContrasena ?? '',
    codigo: notif.codigo ?? '',
    fechaVencimiento: new Date(notif.fechaFin),
    monto: notif.precioFinal ?? 0,
    moneda: notif.moneda ?? 'USD',
    activa: true,
    reembolsada: false,
    enReposo: false,
    promesaPagoHasta: null,
    respuestaCliente: null,
  };
}

/** Texto libre para todas las ventas dadas (un solo cliente): agrupa con {{#items}}. */
export function buildGroupedNoticeText(notifs: readonly NotificacionVentaConId[], contenido: string, now = new Date()): string {
  const first = notifs[0];
  if (!first) return '';
  const group: NoticeGroup = {
    clienteId: first.clienteId,
    clienteNombre: first.clienteNombre,
    telefono: first.clienteTelefono ?? '',
    fechaVencimiento: new Date(first.fechaFin),
    moneda: first.moneda ?? 'USD',
    ventas: notifs.map(toNoticeVenta),
  };
  return renderFreeText(contenido, buildMessageData(group, { now }));
}

/** Vista previa del texto libre para la venta de la fila. */
export function buildNoticePreview(notif: NotificacionVentaConId, contenido: string, now = new Date()): string {
  return buildGroupedNoticeText([notif], contenido, now);
}

/**
 * Respaldo wa.me de un resultado: usa el texto del servidor si vino; si no, y el resultado
 * agrupa varias ventas, lo arma con todas. Con una sola venta devuelve null (flujo existente).
 */
export function resolveResultWaMe(
  result: Pick<NoticeResult, 'ventaIds' | 'waMeText'>,
  candidates: readonly NotificacionVentaConId[],
  contenido: string | undefined,
  now = new Date(),
): { phone: string; text: string } | null {
  const notifs = candidates.filter((notif) => result.ventaIds.includes(notif.ventaId));
  const phone = notifs.find((notif) => notif.clienteTelefono)?.clienteTelefono ?? '';
  if (result.waMeText) return { phone, text: result.waMeText };
  if (result.ventaIds.length < 2 || notifs.length < 2 || !contenido) return null;
  return { phone, text: buildGroupedNoticeText(notifs, contenido, now) };
}

const BADGE_INFO: Record<NoticeBadgeStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'border-warning-border bg-warning-subtle text-warning' },
  sent: { label: 'Enviado', className: 'border-border bg-muted text-muted-foreground' },
  delivered: { label: 'Entregado', className: 'border-info-border bg-info-subtle text-info' },
  read: { label: 'Leído', className: 'border-success-border bg-success-subtle text-success' },
  failed: { label: 'Falló', className: 'border-danger-border bg-danger-subtle text-danger' },
};

export function noticeBadgeInfo(state: VentaNoticeState | undefined): { label: string; className: string; dateLabel: string | null } | null {
  if (!state?.badge) return null;
  const date = state.createdAt ? new Date(state.createdAt) : null;
  const dateLabel = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('es-PA', { day: '2-digit', month: 'short' })
    : null;
  return { ...BADGE_INFO[state.badge], dateLabel };
}

const SKIP_REASONS: Record<string, string> = {
  no_continuar: 'El cliente indicó que no desea continuar',
  reembolsada: 'Venta reembolsada',
  en_reposo: 'Venta en reposo',
  inactiva: 'Venta inactiva',
  promesa_pago: 'Tiene una promesa de pago vigente',
  telefono_invalido: 'Teléfono inválido, revisa el número',
  telefono_ambiguo: 'El teléfono pertenece a más de un cliente',
};

export function noticeReasonLabel(result: Pick<NoticeResult, 'error'>): string {
  if (!result.error) return 'Sin detalle';
  return SKIP_REASONS[result.error] ?? result.error;
}

export function needsWaMeFallback(status: NoticeResult['status']): boolean {
  return status === 'wa_me' || status === 'failed' || status === 'skipped';
}

export type NoticeSummary = {
  sent: NoticeResult[];
  alreadySent: NoticeResult[];
  skipped: NoticeResult[];
  failed: NoticeResult[];
  uncertain: NoticeResult[];
  waMe: NoticeResult[];
};

export function summarizeNoticeResults(results: readonly NoticeResult[]): NoticeSummary {
  const pick = (status: NoticeResult['status']) => results.filter((result) => result.status === status);
  return {
    sent: pick('accepted'),
    alreadySent: pick('already_sent'),
    skipped: pick('skipped'),
    failed: pick('failed'),
    uncertain: pick('uncertain'),
    waMe: pick('wa_me'),
  };
}

export type { NoticeTipo };
