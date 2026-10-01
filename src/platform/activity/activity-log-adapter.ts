import type { ActivityLog } from '@/types';

type ActivityLogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;
export type ActivityLogRecorder = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;

export type ActivityLogOptions = {
  logContext: ActivityLogContext;
  recordActivityLog: ActivityLogRecorder;
};

export type ActivityLogSource = {
  getContext: () => ActivityLogContext;
  record: ActivityLogRecorder;
};

// La identidad y el registro se inyectan desde el composition root de la UI
// (`src/components/providers/activity-log-composition.ts`); platform no lee stores globales.
let source: ActivityLogSource | null = null;

export function configureActivityLogSource(next: ActivityLogSource | null) {
  source = next;
}

function requireSource(): ActivityLogSource {
  if (!source) {
    throw new Error('Activity log source is not configured. Register it in the composition root.');
  }
  return source;
}

export function getActivityLogOptions(): ActivityLogOptions {
  const current = requireSource();
  return {
    logContext: current.getContext(),
    recordActivityLog: current.record,
  };
}

export function recordActivityLog(log: Parameters<ActivityLogRecorder>[0]) {
  return requireSource().record(log);
}

export function getActivityLogContext() {
  return requireSource().getContext();
}
