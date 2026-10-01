import { ValidationError } from '@/platform/errors/domain-errors';
import type { Database, Json } from '@/platform/supabase/database.types';
import { z } from '@/platform/validation/zod';

import { supabase } from './client';

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
  churn_stats?: Json | null;
  updated_at: string | null;
};

type SnapshotRow = Database['public']['Functions']['get_dashboard_stats_snapshot']['Returns'][number];

const snapshotSchema = z.object({
  id: z.string().min(1),
  gastos_total: z.union([z.number(), z.string()]).nullable(),
  ingresos_total: z.union([z.number(), z.string()]).nullable(),
  terceros_por_mes: z.unknown(),
  terceros_por_dia: z.unknown(),
  ingresos_por_mes: z.unknown(),
  ingresos_por_dia: z.unknown(),
  ingresos_por_categoria: z.unknown(),
  ingresos_categorias_por_mes: z.unknown(),
  ventas_pronostico: z.unknown(),
  servicios_pronostico: z.unknown(),
  churn_stats: z.unknown().optional(),
  updated_at: z.string().nullable(),
}).strict();
const dashboardHomeSchema = z.object({
  counts: z.object({ ventasActivas: z.number().optional() }).passthrough(),
  stats: z.record(z.string(), z.unknown()).optional(),
  recentActivity: z.array(z.unknown()).optional(),
}).passthrough();

export async function getDashboardStatsSnapshotRpc(): Promise<DashboardStatsRpcRow | null> {
  const { data, error } = await supabase
    .rpc('get_dashboard_stats_snapshot')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data !== null && !snapshotSchema.safeParse(data satisfies SnapshotRow).success) {
    throw new ValidationError('Respuesta invalida de get_dashboard_stats_snapshot');
  }
  return data;
}

export async function getDashboardHomeRpc(): Promise<Json | null> {
  const { data, error } = await supabase.rpc('get_dashboard_home');
  if (error) throw new Error(error.message);
  if (!dashboardHomeSchema.safeParse(data).success) {
    throw new ValidationError('Respuesta invalida de get_dashboard_home');
  }
  return data;
}
