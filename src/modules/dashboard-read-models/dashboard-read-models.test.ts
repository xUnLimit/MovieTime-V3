import { beforeEach, describe, expect, it, vi } from 'vitest';

const offlineRead = vi.hoisted(() => ({
  getOfflineDashboardHome: vi.fn(),
  shouldUseOfflineRead: vi.fn(),
}));

const dashboardRpc = vi.hoisted(() => ({
  getDashboardChurnStatsRpc: vi.fn(),
  getDashboardHomeRpc: vi.fn(),
  getDashboardStatsLiveRpc: vi.fn(),
}));

vi.mock('@/modules/pwa/offline-copy', () => offlineRead);
vi.mock('@/platform/supabase/dashboard-rpc-adapter', () => dashboardRpc);

import {
  getDashboardChurnStats,
  getDashboardHome,
  getDashboardStats,
  getDiaKeyFromDate,
  getMesKeyFromDate,
} from './dashboard-read-models';

describe('dashboard-read-models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offlineRead.shouldUseOfflineRead.mockResolvedValue(false);
    offlineRead.getOfflineDashboardHome.mockResolvedValue(null);
    dashboardRpc.getDashboardChurnStatsRpc.mockResolvedValue(null);
    dashboardRpc.getDashboardStatsLiveRpc.mockResolvedValue(null);
    dashboardRpc.getDashboardHomeRpc.mockResolvedValue(null);
  });

  it('formats month and day keys', () => {
    const date = new Date('2026-05-23T12:30:00Z');

    expect(getMesKeyFromDate(date)).toBe('2026-05');
    expect(getDiaKeyFromDate(date)).toBe('2026-05-23');
  });

  it('returns offline dashboard stats when offline reads are active', async () => {
    offlineRead.shouldUseOfflineRead.mockResolvedValue(true);
    offlineRead.getOfflineDashboardHome.mockResolvedValue({
      stats: {
        gastosTotal: 3,
        ingresosTotal: 7,
        tercerosPorMes: [],
        tercerosPorDia: [],
        ingresosPorMes: [],
        ingresosPorDia: [],
        ingresosPorCategoria: [],
        ingresosCategoriasPorMes: [],
        ventasPronostico: [],
        serviciosPronostico: [],
        churnStats: {
          kpis: { clientesActivos: 1, clientesInactivos: 0, tasaChurnMesActual: 0 },
          porMes: [],
        },
      },
      counts: { ventasActivas: 1, totalClientes: 1, totalRevendedores: 0 },
      recentActivity: [],
    });

    await expect(getDashboardStats()).resolves.toMatchObject({
      gastosTotal: 3,
      ingresosTotal: 7,
    });
  });

  it('maps live stats and churn RPC payloads', async () => {
    dashboardRpc.getDashboardStatsLiveRpc.mockResolvedValue({
      gastos_total: 12,
      ingresos_total: 24,
      terceros_por_mes: [{ mes: '2026-05', total: 2 }],
      terceros_por_dia: [{ dia: '2026-05-23', total: 1 }],
      ingresos_por_mes: [{ mes: '2026-05', total: 20 }],
      ingresos_por_dia: [{ dia: '2026-05-23', total: 10 }],
      ingresos_por_categoria: [{ categoriaId: 'cat-1', categoriaNombre: 'Streaming', total: 10 }],
      ingresos_categorias_por_mes: [{ mes: '2026-05', categoriaId: 'cat-1', total: 10 }],
      ventas_pronostico: [{ id: 'venta-1', precioFinal: 10 }],
      servicios_pronostico: [{ id: 'servicio-1', costoServicio: 8 }],
      updated_at: '2026-05-23T00:00:00.000Z',
    });
    dashboardRpc.getDashboardChurnStatsRpc.mockResolvedValue({
      kpis: {
        clientesActivos: 10,
        clientesInactivos: 2,
        tasaChurnMesActual: 20,
      },
      porMes: [{ mes: '2026-05', perdidos: 2, activosInicio: 10, churnPct: 20 }],
    });

    await expect(getDashboardStats()).resolves.toMatchObject({
      gastosTotal: 12,
      ingresosTotal: 24,
      tercerosPorMes: [{ mes: '2026-05', total: 2 }],
      churnStats: {
        kpis: {
          clientesActivos: 10,
          clientesInactivos: 2,
          tasaChurnMesActual: 20,
        },
      },
    });
  });

  it('maps dashboard home counts and recent activity', async () => {
    dashboardRpc.getDashboardHomeRpc.mockResolvedValue({
      stats: {
        gastos_total: 1,
        ingresos_total: 2,
        terceros_por_mes: [],
        terceros_por_dia: [],
        ingresos_por_mes: [],
        ingresos_por_dia: [],
        ingresos_por_categoria: [],
        ingresos_categorias_por_mes: [],
        ventas_pronostico: [],
        servicios_pronostico: [],
        churn_stats: {
          kpis: { clientesActivos: 3, clientesInactivos: 1, tasaChurnMesActual: 25 },
          porMes: [],
        },
      },
      counts: {
        ventasActivas: 4,
        totalClientes: 5,
        totalRevendedores: 6,
      },
      recentActivity: [{
        id: 'log-1',
        usuarioId: 'user-1',
        usuarioEmail: 'admin@example.com',
        accion: 'creacion',
        entidad: 'venta',
        entidadId: 'venta-1',
        entidadNombre: 'Venta',
        detalles: 'Creada',
        cambios: [{ campo: 'estado', anterior: null, nuevo: 'activo' }],
        metadata: { origen: 'test' },
        timestamp: '2026-05-23T00:00:00.000Z',
      }],
    });

    await expect(getDashboardHome()).resolves.toMatchObject({
      stats: { gastosTotal: 1, ingresosTotal: 2 },
      counts: {
        ventasActivas: 4,
        totalClientes: 5,
        totalRevendedores: 6,
      },
      recentActivity: [{
        id: 'log-1',
        usuarioEmail: 'admin@example.com',
        entidadId: 'venta-1',
        detalles: 'Creada',
      }],
    });
  });

  it('returns empty home and churn fallbacks for invalid RPC payloads', async () => {
    dashboardRpc.getDashboardHomeRpc.mockResolvedValue([]);

    await expect(getDashboardChurnStats()).resolves.toMatchObject({
      kpis: {
        clientesActivos: 0,
        clientesInactivos: 0,
        tasaChurnMesActual: 0,
      },
      porMes: [],
    });
    await expect(getDashboardHome()).resolves.toMatchObject({
      stats: { gastosTotal: 0, ingresosTotal: 0 },
      counts: { ventasActivas: 0, totalClientes: 0, totalRevendedores: 0 },
      recentActivity: [],
    });
  });
});

