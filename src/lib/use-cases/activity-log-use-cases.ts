import { queryActivityLogs, removeActivityLog } from '@/lib/supabase/activity-log-repository';
import type { ActivityLog } from '@/types';

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
