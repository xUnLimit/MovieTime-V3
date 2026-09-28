import { beforeEach, describe, expect, it, vi } from 'vitest';

const dashboardRpc = vi.hoisted(() => ({
  getDashboardChurnStatsRpc: vi.fn(),
  getDashboardHomeRpc: vi.fn(),
  getDashboardStatsSnapshotRpc: vi.fn(),
  getDashboardStatsLiveRpc: vi.fn(),
}));

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
    dashboardRpc.getDashboardChurnStatsRpc.mockResolvedValue(null);
    dashboardRpc.getDashboardStatsSnapshotRpc.mockResolvedValue(null);
    dashboardRpc.getDashboardStatsLiveRpc.mockResolvedValue(null);
    dashboardRpc.getDashboardHomeRpc.mockResolvedValue(null);
  });

  it('formats month and day keys', () => {
    const date = new Date('2026-05-23T12:30:00Z');

    expect(getMesKeyFromDate(date)).toBe('2026-05');
    expect(getDiaKeyFromDate(date)).toBe('2026-05-23');
  });

  it('maps snapshot stats with embedded churn payload', async () => {
    dashboardRpc.getDashboardStatsSnapshotRpc.mockResolvedValue({
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
      churn_stats: {
        kpis: {
          clientesActivos: 10,
          clientesInactivos: 2,
          tasaChurnMesActual: 20,
        },
        porMes: [{ mes: '2026-05', perdidos: 2, activosInicio: 10, churnPct: 20 }],
      },
      updated_at: '2026-05-23T00:00:00.000Z',
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
    expect(dashboardRpc.getDashboardStatsLiveRpc).not.toHaveBeenCalled();
    expect(dashboardRpc.getDashboardChurnStatsRpc).not.toHaveBeenCalled();
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
