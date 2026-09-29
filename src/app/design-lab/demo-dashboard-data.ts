import { addDays, addMonths, format, startOfMonth, subDays, subMonths } from 'date-fns';

import type { ActivityLog } from '@/types';
import type { DashboardCounts, DashboardStats } from '@/types/dashboard';

/** Datos sinteticos y deterministas para revisar el dashboard sin Supabase. No representan datos reales. */
function wave(index: number, base: number, amplitude: number) {
  return Math.round(base + Math.sin(index * 1.3) * amplitude + (index % 3) * (amplitude / 4));
}

const CATEGORIAS = [
  { categoriaId: 'c1', nombre: 'Netflix', total: 3120, gastos: 1180 },
  { categoriaId: 'c2', nombre: 'Disney+', total: 2240, gastos: 760 },
  { categoriaId: 'c3', nombre: 'Max', total: 1810, gastos: 690 },
  { categoriaId: 'c4', nombre: 'Prime Video', total: 1290, gastos: 1420 },
  { categoriaId: 'c5', nombre: 'Spotify', total: 980, gastos: 310 },
];

export function buildDemoStats(now = new Date()): DashboardStats {
  const months = Array.from({ length: 12 }, (_, i) => subMonths(startOfMonth(now), 11 - i));
  const ingresosPorMes = months.map((m, i) => ({
    mes: format(m, 'yyyy-MM'),
    ingresos: wave(i, 1900, 420),
    gastos: wave(i + 2, 720, 160),
  }));
  const day = now.getDate();
  const dias = Array.from({ length: day }, (_, i) => format(subDays(now, day - 1 - i), 'yyyy-MM-dd'));
  const ingresosPorDia = dias.map((d, i) => ({ dia: d, ingresos: wave(i, 70, 45), gastos: i % 5 === 0 ? wave(i, 90, 30) : 0 }));
  const tercerosPorMes = months.map((m, i) => ({ mes: format(m, 'yyyy-MM'), clientes: wave(i, 12, 5), revendedores: wave(i, 2, 2) }));
  const tercerosPorDia = dias.map((d, i) => ({ dia: d, clientes: i % 4 === 0 ? 0 : wave(i, 1, 1), revendedores: i % 6 === 0 ? 1 : 0 }));
  const churn = months.slice(-6).map((m, i) => {
    const activosInicio = 180 + i * 6;
    const perdidos = wave(i, 6, 3);
    return { mes: format(m, 'yyyy-MM'), perdidos, activosInicio, churnPct: Math.round((perdidos / activosInicio) * 1000) / 10 };
  });

  return {
    gastosTotal: ingresosPorMes.reduce((s, m) => s + m.gastos, 0),
    ingresosTotal: ingresosPorMes.reduce((s, m) => s + m.ingresos, 0),
    tercerosPorMes,
    tercerosPorDia,
    ingresosPorMes,
    ingresosPorDia,
    ingresosPorCategoria: CATEGORIAS,
    ingresosCategoriasPorMes: CATEGORIAS.map((c) => ({ mes: format(now, 'yyyy-MM'), ...c })),
    ventasPronostico: Array.from({ length: 40 }, (_, i) => ({
      id: `v${i}`,
      categoriaId: CATEGORIAS[i % CATEGORIAS.length].categoriaId,
      fechaInicio: addDays(subMonths(now, 1), i).toISOString(),
      fechaFin: addDays(now, 3 + i * 2).toISOString(),
      cicloPago: 'mensual',
      precioFinal: 6 + (i % 4),
      moneda: 'USD',
    })),
    serviciosPronostico: Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      fechaVencimiento: addMonths(addDays(now, 5 + i * 3), 0).toISOString(),
      cicloPago: 'mensual',
      costoServicio: 14 + (i % 3) * 3,
      moneda: 'USD',
    })),
    churnStats: {
      kpis: { clientesActivos: 218, clientesInactivos: 34, tasaChurnMesActual: churn[churn.length - 1].churnPct },
      porMes: churn,
    },
  };
}

export const DEMO_COUNTS: DashboardCounts = { ventasActivas: 218, totalClientes: 252, totalRevendedores: 9 };

const LOGS: Pick<ActivityLog, 'accion' | 'entidad' | 'entidadNombre' | 'detalles'>[] = [
  { accion: 'renovacion', entidad: 'venta', entidadNombre: 'Emmanuel Del Rosario Castillo - Crunchyroll Megafan - Familiar Extendido', detalles: 'Renovación mensual' },
  { accion: 'creacion', entidad: 'venta', entidadNombre: 'Luis Pérez', detalles: 'Nueva venta' },
  { accion: 'corte', entidad: 'venta', entidadNombre: 'Keny Jimenez - Youtube Premium - Familiar', detalles: 'Venta cortada' },
  { accion: 'actualizacion', entidad: 'servicio', entidadNombre: 'Netflix cuenta 4', detalles: 'Cambio de contraseña' },
  { accion: 'reembolso', entidad: 'venta', entidadNombre: 'Jordan Flores Villarreal - Canva Pro Edu - Trimestral', detalles: 'Reembolso parcial' },
  { accion: 'eliminacion', entidad: 'gasto', entidadNombre: 'Hosting', detalles: 'Gasto eliminado' },
];

export function buildDemoActivity(now = new Date()): ActivityLog[] {
  return LOGS.map((log, i) => ({
    id: `log-${i}`,
    usuarioId: 'u1',
    usuarioEmail: 'admin@movietime.pa',
    entidadId: `e${i}`,
    timestamp: new Date(now.getTime() - (i + 1) * 47 * 60 * 1000),
    ...log,
  }));
}
