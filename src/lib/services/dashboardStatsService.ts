import { format } from 'date-fns';
import { supabase } from '@/lib/supabase/client';
import type {
  DashboardStats,
  IngresoCategoria,
  IngresoCategoriaMes,
  IngresosDia,
  IngresosMes,
  ServicioPronostico,
  UsuariosDia,
  UsuariosMes,
  VentaPronostico,
} from '@/types/dashboard';

const STATS_ID = 'singleton';

type DashboardStatsRow = {
  id: string;
  gastos_total: number | string | null;
  ingresos_total: number | string | null;
  usuarios_por_mes: UsuariosMes[] | null;
  usuarios_por_dia: UsuariosDia[] | null;
  ingresos_por_mes: IngresosMes[] | null;
  ingresos_por_dia: IngresosDia[] | null;
  ingresos_por_categoria: IngresoCategoria[] | null;
  ingresos_categorias_por_mes: IngresoCategoriaMes[] | null;
  ventas_pronostico: VentaPronostico[] | null;
  servicios_pronostico: ServicioPronostico[] | null;
  updated_at: string | null;
};

function createEmptyStats(): DashboardStats {
  return {
    gastosTotal: 0,
    ingresosTotal: 0,
    usuariosPorMes: [],
    usuariosPorDia: [],
    ingresosPorMes: [],
    ingresosPorDia: [],
    ingresosPorCategoria: [],
    ingresosCategoriasPorMes: [],
    ventasPronostico: [],
    serviciosPronostico: [],
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase
    .from('dashboard_stats')
    .select('*')
    .eq('id', STATS_ID)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return createEmptyStats();

  return rowToStats(data as DashboardStatsRow);
}

export async function adjustIngresosStats(_params: {
  delta: number;
  moneda: string;
  mes: string;
  dia: string;
  categoriaId: string;
  categoriaNombre: string;
}): Promise<void> {
  void _params;
  await rebuildDashboardStats();
}

export async function adjustGastosStats(_params: {
  delta: number;
  moneda: string;
  mes: string;
  dia: string;
  categoriaId?: string;
  categoriaNombre?: string;
}): Promise<void> {
  void _params;
  await rebuildDashboardStats();
}

export async function adjustUsuariosPorMes(_params: {
  mes: string;
  dia: string;
  tipo: 'cliente' | 'revendedor';
  delta: 1 | -1;
}): Promise<void> {
  void _params;
  await rebuildDashboardStats();
}

export async function upsertVentaPronostico(
  _venta: VentaPronostico | null,
  _ventaId: string
): Promise<void> {
  void _venta;
  void _ventaId;
  await rebuildDashboardStats();
}

export async function upsertServicioPronostico(
  _servicio: ServicioPronostico | null,
  _servicioId: string
): Promise<void> {
  void _servicio;
  void _servicioId;
  await rebuildDashboardStats();
}

export async function rebuildDashboardStats(_preFetchedData?: unknown): Promise<void> {
  void _preFetchedData;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error('No hay una sesion activa para recalcular el dashboard');

  const response = await fetch('/api/dashboard/rebuild', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(typeof body.error === 'string' ? body.error : 'Error al recalcular el dashboard');
  }
}

export function getMesKeyFromDate(date: Date): string {
  return format(date, 'yyyy-MM');
}

export function getDiaKeyFromDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function rowToStats(row: DashboardStatsRow): DashboardStats {
  return {
    gastosTotal: Number(row.gastos_total ?? 0),
    ingresosTotal: Number(row.ingresos_total ?? 0),
    usuariosPorMes: row.usuarios_por_mes ?? [],
    usuariosPorDia: row.usuarios_por_dia ?? [],
    ingresosPorMes: row.ingresos_por_mes ?? [],
    ingresosPorDia: row.ingresos_por_dia ?? [],
    ingresosPorCategoria: row.ingresos_por_categoria ?? [],
    ingresosCategoriasPorMes: row.ingresos_categorias_por_mes ?? [],
    ventasPronostico: row.ventas_pronostico ?? [],
    serviciosPronostico: row.servicios_pronostico ?? [],
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}
