import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { getDashboardHomeRpc, getDashboardStatsSnapshotRpc, type DashboardStatsRpcRow } from './dashboard-rpc-adapter';

const statsRow: DashboardStatsRpcRow = {
  id: 'dashboard',
  gastos_total: 5,
  ingresos_total: 10,
  terceros_por_mes: [],
  terceros_por_dia: [],
  ingresos_por_mes: [],
  ingresos_por_dia: [],
  ingresos_por_categoria: [],
  ingresos_categorias_por_mes: [],
  ventas_pronostico: [],
  servicios_pronostico: [],
  updated_at: '2026-05-22T00:00:00.000Z',
};

describe('getDashboardStatsSnapshotRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed snapshot RPC and returns the row', async () => {
    rpcMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    maybeSingleMock.mockResolvedValue({ data: statsRow, error: null });

    await expect(getDashboardStatsSnapshotRpc()).resolves.toBe(statsRow);

    expect(rpcMock).toHaveBeenCalledWith('get_dashboard_stats_snapshot');
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'Snapshot failed' } });

    await expect(getDashboardStatsSnapshotRpc()).rejects.toThrow('Snapshot failed');
  });
});

describe('dashboard JSON RPCs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the home RPC and returns JSON data', async () => {
    const data = { counts: { ventasActivas: 1 } };
    rpcMock.mockResolvedValue({ data, error: null });

    await expect(getDashboardHomeRpc()).resolves.toBe(data);

    expect(rpcMock).toHaveBeenCalledWith('get_dashboard_home');
  });
});
