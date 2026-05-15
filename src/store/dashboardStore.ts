import { logCacheHit } from '@/lib/supabase/dashboard-repository';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { getDashboardHome, getDashboardStats } from '@/lib/services/dashboardStatsService';
import { CACHE_TTL_MS } from '@/lib/constants';
import type { DashboardStats, DashboardCounts } from '@/types/dashboard';
import type { ActivityLog } from '@/types';

interface DashboardState {
  stats: DashboardStats | null;
  counts: DashboardCounts;
  recentActivity: ActivityLog[];
  isLoading: boolean;
  isRecalculating: boolean;
  error: string | null;
  lastFetch: number | null;
  lastStatsFetch: number | null;

  fetchDashboard: (force?: boolean) => Promise<void>;
  /** Solo carga métricas financieras del dashboard (sin counts de terceros ni actividad) */
  fetchDashboardStats: (force?: boolean) => Promise<void>;
  recalculateDashboard: () => Promise<void>;
  /** Invalidate cache so the dashboard re-fetches on next visit */
  invalidateCache: () => void;
}

const CACHE_TIMEOUT = CACHE_TTL_MS;

const EMPTY_COUNTS: DashboardCounts = {
  ventasActivas: 0,
  totalClientes: 0,
  totalRevendedores: 0,
};

export const useDashboardStore = create<DashboardState>()(
  devtools(
    (set, get) => ({
      stats: null,
      counts: EMPTY_COUNTS,
      recentActivity: [],
      isLoading: false,
      isRecalculating: false,
      error: null,
      lastFetch: null,
      lastStatsFetch: null,

      fetchDashboard: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && Date.now() - lastFetch < CACHE_TIMEOUT) {
          logCacheHit('dashboard');
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const { stats, counts, recentActivity } = await getDashboardHome();

          set({
            stats,
            counts,
            recentActivity,
            isLoading: false,
            error: null,
            lastFetch: Date.now(),
          });

        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Error al cargar el dashboard';
          console.error('Error fetching dashboard:', error);
          set({ isLoading: false, error: errorMessage });
        }
      },

      fetchDashboardStats: async (force = false) => {
        const { lastStatsFetch, stats } = get();
        if (!force && stats && lastStatsFetch && Date.now() - lastStatsFetch < CACHE_TIMEOUT) {
          logCacheHit('dashboard-stats');
          return;
        }
        try {
          const freshStats = await getDashboardStats();
          set({ stats: freshStats, lastStatsFetch: Date.now() });
        } catch (error) {
          console.error('Error fetching dashboard stats:', error);
        }
      },

      invalidateCache: () => {
        set({ lastFetch: null, lastStatsFetch: null });
      },

      recalculateDashboard: async () => {
        set({ isRecalculating: true, error: null });
        try {
          await get().fetchDashboard(true);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Error al recalcular el dashboard';
          console.error('Error recalculating dashboard:', error);
          set({ error: errorMessage });
        } finally {
          set({ isRecalculating: false });
        }
      },
    }),
    { name: 'dashboard-store' }
  )
);
