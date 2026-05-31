import type { ActivityLogOptions } from '@/application/activity/activity-log-types';
import { getStoreLogContext } from '@/platform/utils/storeHelpers';
import { useActivityLogStore } from '@/store/activityLogStore';
import type { ActivityLog } from '@/types';

export type { ActivityLogOptions } from '@/application/activity/activity-log-types';

export function getActivityLogOptions(): ActivityLogOptions {
  return {
    logContext: getStoreLogContext(),
    recordActivityLog: useActivityLogStore.getState().addLog,
  };
}

export function recordActivityLog(log: Omit<ActivityLog, 'id' | 'timestamp'>) {
  return useActivityLogStore.getState().addLog(log);
}

export function getActivityLogContext() {
  return getStoreLogContext();
}
