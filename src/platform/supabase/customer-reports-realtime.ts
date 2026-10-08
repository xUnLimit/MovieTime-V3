import { supabase } from './client';
import { safeAsyncSideEffect } from '@/platform/utils/safety';
import { createLogger } from '@/platform/observability/logger';

export type ReportRealtimeStatus = 'live' | 'offline';
export interface ReportRealtimeListener {
  onChange: () => void;
  onStatus: (status: ReportRealtimeStatus) => void;
}

let sequence = 0;

/** Los eventos solo invalidan la lectura por API; no se usan sus datos como estado UI. */
export function subscribeToReportChanges(listener: ReportRealtimeListener): () => void {
  let active = true;
  let channel: ReturnType<typeof supabase.channel> | undefined;
  listener.onStatus('offline');
  try {
    channel = supabase.channel(`customer-reports-${++sequence}`);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'customer_reports' }, () => {
      if (active) listener.onChange();
    }).subscribe(status => {
      if (!active) return;
      listener.onStatus(status === 'SUBSCRIBED' ? 'live' : 'offline');
    });
  } catch {
    createLogger('ReportRealtime').warn('No se pudo iniciar Realtime; se conserva la consulta de respaldo');
  }
  return () => {
    if (!active) return;
    active = false;
    if (channel) safeAsyncSideEffect(supabase.removeChannel(channel), { operation: 'cerrar Realtime de reportes' });
  };
}
