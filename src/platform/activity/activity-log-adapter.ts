import type { ActivityLogOptions } from '@/application/activity/activity-log-types';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import type { ActivityLog } from '@/types';

export type { ActivityLogOptions } from '@/application/activity/activity-log-types';

function getStoreLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

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
