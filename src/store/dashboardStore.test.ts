import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardCounts, DashboardStats } from '@/types/dashboard';

const getDashboardHome = vi.hoisted(() => vi.fn());
const getDashboardStats = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/dashboardStatsService', () => ({
  getDashboardHome,
  getDashboardStats,
}));

vi.mock('@/lib/supabase/dashboard-repository', () => ({
  logCacheHit: vi.fn(),
}));

import { useDashboardStore } from './dashboardStore';

const counts: DashboardCounts = {
  ventasActivas: 1,
  totalClientes: 2,
  totalRevendedores: 3,
};

const stats: DashboardStats = {
  gastosTotal: 10,
  ingresosTotal: 20,
  tercerosPorMes: [],
  tercerosPorDia: [],
  ingresosPorMes: [],
  ingresosPorDia: [],
  ingresosPorCategoria: [],
  ingresosCategoriasPorMes: [],
  ventasPronostico: [],
  serviciosPronostico: [],
  churnStats: {
    kpis: {
      clientesActivos: 0,
      clientesInactivos: 0,
      tasaChurnMesActual: 0,
    },
    porMes: [],
  },
};

function resetDashboardStore() {
  useDashboardStore.setState({
    stats: null,
    counts: {
      ventasActivas: 0,
      totalClientes: 0,
      totalRevendedores: 0,
    },
    recentActivity: [],
    isLoading: false,
    error: null,
    lastFetch: null,
    lastStatsFetch: null,
  });
}

describe('dashboardStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDashboardStore();
  });

  it('does not show cold loading while refreshing existing dashboard data', async () => {
    useDashboardStore.setState({
      stats,
      counts,
      recentActivity: [],
      lastFetch: null,
      isLoading: false,
    });

    let resolveHome!: (value: { stats: DashboardStats; counts: DashboardCounts; recentActivity: [] }) => void;
    getDashboardHome.mockReturnValueOnce(new Promise((resolve) => {
      resolveHome = resolve;
    }));

    const fetchPromise = useDashboardStore.getState().fetchDashboard();

    expect(useDashboardStore.getState().isLoading).toBe(false);

    resolveHome({ stats, counts, recentActivity: [] });
    await fetchPromise;

    expect(useDashboardStore.getState().isLoading).toBe(false);
  });
});
