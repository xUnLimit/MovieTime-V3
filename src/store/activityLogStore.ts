import { createActivityLog } from '@/lib/supabase/activity-log-repository';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ActivityLog } from '@/types';

interface ActivityLogState {
  addLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
}

export const useActivityLogStore = create<ActivityLogState>()(
  devtools(
    () => ({
      addLog: async (logData) => {
        await createActivityLog({
          ...logData,
          timestamp: new Date().toISOString(),
        });
      },
    }),
    { name: 'activity-log-store' }
  )
);
