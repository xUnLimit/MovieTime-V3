import type { Json } from '@/lib/supabase/database.types';

import { supabase } from './client';

type RpcError = { message: string } | null;

type RpcResult<T> = {
  data: T | null;
  error: RpcError;
};

export type DashboardStatsRpcRow = {
  id: string;
  gastos_total: number | string | null;
  ingresos_total: number | string | null;
  terceros_por_mes: Json | null;
  terceros_por_dia: Json | null;
  ingresos_por_mes: Json | null;
  ingresos_por_dia: Json | null;
  ingresos_por_categoria: Json | null;
  ingresos_categorias_por_mes: Json | null;
  ventas_pronostico: Json | null;
  servicios_pronostico: Json | null;
  updated_at: string | null;
};

type DashboardStatsRpcClient = {
  rpc: (fn: 'get_dashboard_stats_live') => {
    maybeSingle: () => Promise<RpcResult<DashboardStatsRpcRow>>;
  };
};

type DashboardJsonRpcClient = {
  rpc: (
    fn: 'get_dashboard_churn_stats' | 'get_dashboard_home',
    args?: never
  ) => Promise<RpcResult<Json>>;
};

const dashboardStatsRpcClient = supabase as unknown as DashboardStatsRpcClient;
const dashboardJsonRpcClient = supabase as unknown as DashboardJsonRpcClient;

export async function getDashboardStatsLiveRpc(): Promise<DashboardStatsRpcRow | null> {
  const { data, error } = await dashboardStatsRpcClient
    .rpc('get_dashboard_stats_live')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getDashboardChurnStatsRpc(): Promise<Json | null> {
  const { data, error } = await dashboardJsonRpcClient.rpc('get_dashboard_churn_stats');
  if (error) throw new Error(error.message);
  return data;
}

export async function getDashboardHomeRpc(): Promise<Json | null> {
  const { data, error } = await dashboardJsonRpcClient.rpc('get_dashboard_home');
  if (error) throw new Error(error.message);
  return data;
}
