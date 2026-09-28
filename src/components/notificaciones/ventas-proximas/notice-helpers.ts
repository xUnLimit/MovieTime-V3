import type { NoticeBadgeStatus, VentaNoticeState } from '@/application/use-cases/whatsapp-notices-use-cases';
import { buildMessageData, renderFreeText, type NoticeGroup, type NoticeVenta } from '@/modules/messaging/message-data';
import type { NoticeResult, NoticeTipo } from '@/platform/api/whatsapp-notices-client';

import type { NotificacionVentaConId } from './types';

export type RuleTipo = 'dia_pago';

/** Aviso de pago: un solo tipo ("Aviso de vencimiento") antes y el dia del vencimiento. */
export function noticeTipoFor(_diasRestantes: number): RuleTipo {
  return 'dia_pago';
}

export function groupNotificationsByTipo(notifs: readonly NotificacionVentaConId[]): Array<{ tipo: RuleTipo; ventaIds: string[] }> {
  const groups = new Map<RuleTipo, string[]>();
  for (const notif of notifs) {
    const tipo = noticeTipoFor(notif.diasRestantes);
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
  pending: { label: 'Pendiente', className: 'border-amber-500/50 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  sent: { label: 'Enviado', className: 'border-slate-400/50 bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300' },
  delivered: { label: 'Entregado', className: 'border-blue-500/50 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  read: { label: 'Leído', className: 'border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' },
  failed: { label: 'Falló', className: 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
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
