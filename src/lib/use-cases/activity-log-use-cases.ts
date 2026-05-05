import { countActivityLogs, queryActivityLogs, removeActivityLog } from '@/lib/supabase/activity-log-repository';
import { ENTITIES } from '@/lib/supabase/entities';
import type { QueryFilter } from '@/lib/supabase/entities';
import type { ActivityLog } from '@/types';

export const ACTIVITY_LOG_COLLECTION = ENTITIES.ACTIVITY_LOG;

export function countActivityLogsUseCase(filters: QueryFilter[] = []) {
  return countActivityLogs(filters);
}

export async function deleteActivityLogsUseCase(ids: string[]) {
  await Promise.all(ids.map((id) => removeActivityLog(id)));
}

export async function deleteActivityLogsOlderThanUseCase(cutoff: Date) {
  const oldLogs = await queryActivityLogs<ActivityLog>([
    { field: 'timestamp', operator: '<', value: cutoff },
  ]);
  await deleteActivityLogsUseCase(oldLogs.map((log) => log.id));
  return oldLogs.length;
}
