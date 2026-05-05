'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, eachMonthOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDashboardStore } from '@/store/dashboardStore';
import { Skeleton } from '@/components/ui/skeleton';
import type { IngresosMes, IngresosDia } from '@/types/dashboard';

interface DiaData {
  dia: string;
  ingresos: number;
  gastos: number;
}

export function IngresosVsGastosChart() {
  const [selectedMonth, setSelectedMonth] = useState('actual');
  const { stats, isLoading } = useDashboardStore();
  const axisColor = 'var(--muted-foreground)';
  const gridColor = 'var(--border)';
  const tooltipBg = 'var(--background)';
  const tooltipBorder = 'var(--border)';
  const tooltipText = 'var(--foreground)';

  const data = useMemo((): DiaData[] => {
    const ingresosPorMes: IngresosMes[] = stats?.ingresosPorMes ?? [];
    const ingresosPorDia: IngresosDia[] = stats?.ingresosPorDia ?? [];
    const currentDate = new Date();
    if (selectedMonth === 'actual') {
      // Usar datos reales por día desde dashboard_stats (0 reads extra)
      // Incluye días futuros del mes actual si tienen datos registrados
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const diaMap = new Map(ingresosPorDia.map(d => [d.dia, d]));

      return days.map((day) => {
        const diaKey = format(day, 'yyyy-MM-dd');
        const entry = diaMap.get(diaKey);
        return {
          dia: format(day, 'd MMM', { locale: es }),
          ingresos: entry?.ingresos ?? 0,
          gastos: entry?.gastos ?? 0,
        };
      });
    }

    // Datos mensuales para 3, 6 o 12 meses (solo hasta el mes actual)
    const monthsBack = selectedMonth === '3meses' ? 3 : selectedMonth === '6meses' ? 6 : 12;
    const startDate = subMonths(currentDate, monthsBack - 1);

    const months = eachMonthOfInterval({ start: startOfMonth(startDate), end: startOfMonth(currentDate) });
    const mesMap = new Map(ingresosPorMes.map(m => [m.mes, m]));

    return months.map((month) => {
      const mesKey = format(month, 'yyyy-MM');
      const entry = mesMap.get(mesKey);
      return {
        dia: format(month, 'MMM yyyy', { locale: es }),
        ingresos: entry?.ingresos ?? 0,
        gastos: entry?.gastos ?? 0,
      };
    });
  }, [selectedMonth, stats]);

  return (
    <Card className="py-3 gap-0">
      <CardHeader className="flex flex-col gap-2 p-0 px-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Ingresos vs Gastos</CardTitle>
          <CardDescription className="text-sm hidden sm:block">
            Comparativa mensual de los ingresos totales por ventas y los gastos totales registrados.
          </CardDescription>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
            <SelectValue placeholder="Seleccionar mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="actual">Mes actual</SelectItem>
            <SelectItem value="3meses">Últimos 3 meses</SelectItem>
            <SelectItem value="6meses">Últimos 6 meses</SelectItem>
            <SelectItem value="12meses">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-1">
        {isLoading ? (
          <Skeleton className="w-full h-[320px] rounded-lg" />
        ) : (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 15, right: 30, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorIngresosRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorGastosRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.2} />
            <XAxis
              dataKey="dia"
              stroke={axisColor}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              interval={selectedMonth === 'actual' ? 1 : 0}
              tick={{ fill: axisColor }}
            />
            <YAxis
              stroke={axisColor}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
              tick={{ fill: axisColor }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '8px',
              }}
              itemSorter={(item) => (item.dataKey === 'ingresos' ? 0 : 1)}
              formatter={(value: number | undefined) => {
                if (value === undefined) return '';
                return `$${value.toFixed(2)}`;
              }}
              labelStyle={{ color: tooltipText }}
              animationDuration={0}
            />
            <Legend
              verticalAlign="bottom"
              height={20}
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
            <Area
              type="monotone"
              dataKey="ingresos"
              stroke="#7c3aed"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorIngresosRevenue)"
              name="Ingresos"
              animationDuration={1000}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="gastos"
              stroke="#dc2626"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorGastosRevenue)"
              name="Gastos"
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
