import {
  createActivityLog,
  queryActivityLogs,
  removeActivityLog,
} from '@/lib/supabase/activity-log-repository';
import { ENTITIES } from '@/lib/supabase/entities';
import type { ActivityLog } from '@/types';

export const ACTIVITY_LOG_COLLECTION = ENTITIES.ACTIVITY_LOG;

export { countActivityLogs as countActivityLogsUseCase, removeAllActivityLogs as deleteAllActivityLogsUseCase } from '@/lib/supabase/activity-log-repository';

export function createActivityLogUseCase(logData: Omit<ActivityLog, 'id' | 'timestamp'>) {
  return createActivityLog({
    ...logData,
    timestamp: new Date().toISOString(),
  });
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
