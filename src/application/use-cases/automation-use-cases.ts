import { activitySince, summarizeActivity, type TipoActivity } from '@/modules/messaging/automation-activity';
import { listNoticeActivityRows, listRecentNotices } from '@/platform/supabase/notice-activity-repository';
import type { RecentNoticeFilters, RecentNoticePage } from '@/types/automation';

/** Enviados, fallidos y omitidos de los ultimos 30 dias, por tipo de mensaje. */
export async function loadNoticeActivityUseCase(now: Date = new Date()): Promise<Record<string, TipoActivity>> {
  return summarizeActivity(await listNoticeActivityRows(activitySince(now)));
}

export function listRecentNoticesUseCase(page: number, filters: RecentNoticeFilters): Promise<RecentNoticePage> {
  return listRecentNotices(page, filters);
}
