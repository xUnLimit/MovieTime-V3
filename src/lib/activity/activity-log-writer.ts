import type { LogContext as ServicioLogContext, RecordActivityLog as ServicioRecordActivityLog } from '@/lib/use-cases/servicios/servicios-shared';
import type { LogContext as VentaLogContext, RecordActivityLog as VentaRecordActivityLog } from '@/lib/use-cases/ventas/ventas-shared';
import { getStoreLogContext } from '@/platform/utils/storeHelpers';
import { useActivityLogStore } from '@/store/activityLogStore';
import type { ActivityLog } from '@/types';

export type ActivityLogOptions = {
  logContext: ServicioLogContext & VentaLogContext;
  recordActivityLog: ServicioRecordActivityLog & VentaRecordActivityLog;
};

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
