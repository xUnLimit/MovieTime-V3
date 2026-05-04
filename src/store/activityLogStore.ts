import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ActivityLog, AccionLog, EntidadLog } from '@/types';
import { getAll, create as createDoc, remove, COLLECTIONS, logCacheHit } from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';

interface ActivityLogState {
  logs: ActivityLog[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;

  // Actions
  fetchLogs: (force?: boolean) => Promise<void>;
  addLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
  clearLogs: () => Promise<void>;
  getLogsByEntidad: (entidad: EntidadLog) => ActivityLog[];
  getLogsByAccion: (accion: AccionLog) => ActivityLog[];
  getRecentLogs: (limit: number) => ActivityLog[];
}

const CACHE_TIMEOUT = 5 * 60 * 1000;

export const useActivityLogStore = create<ActivityLogState>()(
  devtools(
    (set, get) => ({
      logs: [],
      isLoading: false,
      error: null,
      lastFetch: null,

      fetchLogs: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && (Date.now() - lastFetch) < CACHE_TIMEOUT) {
          logCacheHit(COLLECTIONS.ACTIVITY_LOG);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const logs = (await getAll<ActivityLog>(COLLECTIONS.ACTIVITY_LOG))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

          set({ logs, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar logs';
          console.error('Error fetching activity logs:', error);
          set({ logs: [], isLoading: false, error: errorMessage });
        }
      },

      addLog: async (logData) => {
        try {
          const id = await createDoc(COLLECTIONS.ACTIVITY_LOG, {
            ...logData,
            timestamp: Timestamp.now()
          });

          const newLog: ActivityLog = {
            ...logData,
            id,
            timestamp: new Date()
          };

          set((state) => ({
            logs: [newLog, ...state.logs]
          }));
        } catch (error) {
          console.error('Error adding activity log:', error);
          throw error;
        }
      },

      clearLogs: async () => {
        set({ isLoading: true });
        try {
          const logs = get().logs;
          await Promise.all(logs.map(log => remove(COLLECTIONS.ACTIVITY_LOG, log.id)));
          set({ logs: [], isLoading: false });
        } catch (error) {
          console.error('Error clearing logs:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      getLogsByEntidad: (entidad) => {
        return get().logs.filter((log) => log.entidad === entidad);
      },

      getLogsByAccion: (accion) => {
        return get().logs.filter((log) => log.accion === accion);
      },

      getRecentLogs: (limit) => {
        return get().logs.slice(0, limit);
      }
    }),
    { name: 'activity-log-store' }
  )
);
