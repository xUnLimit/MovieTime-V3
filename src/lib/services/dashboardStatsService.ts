import { format } from 'date-fns';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';
import { getOfflineDashboardHome, shouldUseOfflineRead } from '@/lib/pwa/offline-read';
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
  DashboardCounts,
} from '@/types/dashboard';
import type { ActivityLog } from '@/types';

type DashboardStatsRow = {
  id: string;
  gastos_total: number | string | null;
  ingresos_total: number | string | null;
  usuarios_por_mes: Json | null;
  usuarios_por_dia: Json | null;
  ingresos_por_mes: Json | null;
  ingresos_por_dia: Json | null;
  ingresos_por_categoria: Json | null;
  ingresos_categorias_por_mes: Json | null;
  ventas_pronostico: Json | null;
  servicios_pronostico: Json | null;
  updated_at: string | null;
};

type DashboardHome = {
  stats: DashboardStats;
  counts: DashboardCounts;
  recentActivity: ActivityLog[];
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
  if (await shouldUseOfflineRead()) {
    return (await getOfflineDashboardHome())?.stats ?? createEmptyStats();
  }

  const { data, error } = await supabase.rpc('get_dashboard_stats_live').maybeSingle();

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
}

export async function getDashboardHome(): Promise<DashboardHome> {
  if (await shouldUseOfflineRead()) {
    const offline = await getOfflineDashboardHome();
    if (offline) return offline;
  }

  const { data, error } = await supabase.rpc('get_dashboard_home');
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      stats: createEmptyStats(),
      counts: { ventasActivas: 0, totalClientes: 0, totalRevendedores: 0 },
      recentActivity: [],
    };
  }

  const record = data as Record<string, Json>;
  const counts = asRecord(record.counts);

  return {
    stats: rowToStats(asRecord(record.stats) as unknown as DashboardStatsRow),
    counts: {
      ventasActivas: Number(counts.ventasActivas ?? 0),
      totalClientes: Number(counts.totalClientes ?? 0),
      totalRevendedores: Number(counts.totalRevendedores ?? 0),
    },
    recentActivity: jsonArray<Record<string, unknown>>(record.recentActivity).map(activityLogFromJson),
  };
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
}

export async function adjustUsuariosPorMes(_params: {
  mes: string;
  dia: string;
  tipo: 'cliente' | 'revendedor';
  delta: 1 | -1;
}): Promise<void> {
  void _params;
}

export async function upsertVentaPronostico(
  _venta: VentaPronostico | null,
  _ventaId: string
): Promise<void> {
  void _venta;
  void _ventaId;
}

export async function upsertServicioPronostico(
  _servicio: ServicioPronostico | null,
  _servicioId: string
): Promise<void> {
  void _servicio;
  void _servicioId;
}

export async function rebuildDashboardStats(_preFetchedData?: unknown): Promise<void> {
  void _preFetchedData;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Esta accion requiere conexion a internet.');
  }
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
    usuariosPorMes: jsonArray<UsuariosMes>(row.usuarios_por_mes),
    usuariosPorDia: jsonArray<UsuariosDia>(row.usuarios_por_dia),
    ingresosPorMes: jsonArray<IngresosMes>(row.ingresos_por_mes),
    ingresosPorDia: jsonArray<IngresosDia>(row.ingresos_por_dia),
    ingresosPorCategoria: jsonArray<IngresoCategoria>(row.ingresos_por_categoria),
    ingresosCategoriasPorMes: jsonArray<IngresoCategoriaMes>(row.ingresos_categorias_por_mes),
    ventasPronostico: jsonArray<VentaPronostico>(row.ventas_pronostico),
    serviciosPronostico: jsonArray<ServicioPronostico>(row.servicios_pronostico),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

function jsonArray<T>(value: Json | null): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: Json | undefined): Record<string, Json> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json>
    : {};
}

function activityLogFromJson(row: Record<string, unknown>): ActivityLog {
  return {
    id: String(row.id ?? ''),
    usuarioId: String(row.usuarioId ?? ''),
    usuarioEmail: String(row.usuarioEmail ?? ''),
    accion: row.accion as ActivityLog['accion'],
    entidad: row.entidad as ActivityLog['entidad'],
    entidadId: String(row.entidadId ?? ''),
    entidadNombre: String(row.entidadNombre ?? ''),
    detalles: String(row.detalles ?? ''),
    cambios: Array.isArray(row.cambios) ? row.cambios as ActivityLog['cambios'] : undefined,
    metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : undefined,
    timestamp: row.timestamp ? new Date(String(row.timestamp)) : new Date(0),
  };
}
