import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { getDashboardStats, rebuildDashboardStats } from '@/lib/services/dashboardStatsService';
import { getCount, COLLECTIONS, logCacheHit, convertTimestamps } from '@/lib/firebase/firestore';
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
  /** Solo carga el doc config/dashboard_stats (sin counts de usuarios ni actividad) */
  fetchDashboardStats: (force?: boolean) => Promise<void>;
  recalculateDashboard: () => Promise<void>;
  /** Invalidate cache so the dashboard re-fetches on next visit */
  invalidateCache: () => void;
}

const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

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
          const [stats, ventasActivas, totalClientes, totalRevendedores, recentActivity] =
            await Promise.all([
              getDashboardStats(),
              getCount(COLLECTIONS.VENTAS, [
                { field: 'estado', operator: '==', value: 'activo' },
              ]),
              getCount(COLLECTIONS.USUARIOS, [
                { field: 'tipo', operator: '==', value: 'cliente' },
              ]),
              getCount(COLLECTIONS.USUARIOS, [
                { field: 'tipo', operator: '==', value: 'revendedor' },
              ]),
              getDocs(
                query(
                  collection(db, COLLECTIONS.ACTIVITY_LOG),
                  orderBy('timestamp', 'desc'),
                  limit(6)
                )
              ).then((snap) =>
                snap.docs.map((d) => ({
                  id: d.id,
                  ...(convertTimestamps(d.data()) as Record<string, unknown>),
                } as ActivityLog))
              ),
            ]);

          set({
            stats,
            counts: { ventasActivas, totalClientes, totalRevendedores },
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
          await rebuildDashboardStats();
          // Force-refresh after rebuild so UI reflects new data immediately
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
