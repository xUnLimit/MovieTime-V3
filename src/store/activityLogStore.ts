import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createActivityLogUseCase } from '@/application/use-cases/activity-log-use-cases';
import type { ActivityLog } from '@/types';

interface ActivityLogState {
  addLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
}

export const useActivityLogStore = create<ActivityLogState>()(
  devtools(
    () => ({
      addLog: async (logData) => {
        await createActivityLogUseCase(logData);
      },
    }),
    { name: 'activity-log-store' }
  )
);
