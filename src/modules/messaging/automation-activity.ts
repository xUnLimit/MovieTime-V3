import type { NoticeActivityRow, NoticeStatus } from '@/types/automation';

const ACTIVITY_WINDOW_DAYS = 30;

export type TipoActivity = { sent: number; failed: number; skipped: number; lastSentAt: string | null };

export const NOTICE_STATUS_LABELS: Record<NoticeStatus, string> = {
  accepted: 'Enviado',
  failed: 'Fallido',
  skipped: 'Omitido',
  pending: 'Pendiente',
};

const SKIP_REASON_LABELS: Record<string, string> = {
  no_continuar: 'El cliente no desea continuar',
  reembolsada: 'Venta reembolsada',
  en_reposo: 'Servicio en reposo',
  inactiva: 'Venta inactiva',
  promesa_pago: 'Promesa de pago vigente',
};

/** Motivo legible de un aviso omitido; un codigo desconocido no se muestra crudo. */
export function skipReasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  return SKIP_REASON_LABELS[reason] ?? 'Otro motivo';
}

export function activitySince(now: Date): string {
  return new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function emptyActivity(): TipoActivity {
  return { sent: 0, failed: 0, skipped: 0, lastSentAt: null };
}

/** Cuenta enviados (accepted), fallidos y omitidos por tipo; la fecha es la del ultimo enviado. */
export function summarizeActivity(rows: readonly NoticeActivityRow[]): Record<string, TipoActivity> {
  const result: Record<string, TipoActivity> = {};
  for (const row of rows) {
    const entry = result[row.tipo] ?? (result[row.tipo] = emptyActivity());
    if (row.status === 'accepted') {
      entry.sent += 1;
      if (!entry.lastSentAt || Date.parse(row.createdAt) > Date.parse(entry.lastSentAt)) entry.lastSentAt = row.createdAt;
    } else if (row.status === 'failed') entry.failed += 1;
    else if (row.status === 'skipped') entry.skipped += 1;
  }
  return result;
}
