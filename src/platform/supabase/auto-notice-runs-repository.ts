import type { AutoNoticeRun } from '@/types';

import { supabase } from './client';

const STATUSES: readonly AutoNoticeRun['status'][] = ['running', 'done', 'failed'];

// Ultimas corridas del envio automatico (solo lectura; escribe el servidor).
export async function listRecentAutoNoticeRuns(limit = 7): Promise<AutoNoticeRun[]> {
  const { data, error } = await supabase
    .from('auto_notice_runs')
    .select('id, run_date, status, sent, failed, skipped, already_sent')
    .order('run_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    runDate: row.run_date,
    status: STATUSES.find((status) => status === row.status) ?? 'failed',
    sent: row.sent,
    failed: row.failed,
    skipped: row.skipped,
    alreadySent: row.already_sent,
  }));
}
