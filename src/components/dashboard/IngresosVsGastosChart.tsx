'use client';

import { useState, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Skeleton } from '@/components/ui/skeleton';
import { FilterTriggerContent } from '@/components/shared/FilterTriggerContent';
import { Panel } from '@/components/shared/Panel';
import type { IngresosMes, IngresosDia } from '@/types/dashboard';
import { Button } from '@/components/ui/button';
import { CalendarClock, Check } from 'lucide-react';
import { useDashboardHome } from '@/hooks/use-dashboard-home';
import { chartColors, chartInitialDimension, chartTooltipLabelStyle, chartTooltipStyle } from './chart-theme';

interface DiaData {
  dia: string;
  ingresos: number;
  gastos: number;
}

const PERIOD_OPTIONS = [
  { value: 'actual', label: 'Mes actual' },
  { value: '3meses', label: 'Últimos 3 meses' },
  { value: '6meses', label: 'Últimos 6 meses' },
  { value: '12meses', label: 'Últimos 12 meses' },
];

export function IngresosVsGastosChart() {
  const [selectedMonth, setSelectedMonth] = useState('actual');
  const { data: dashboardHome, isLoading } = useDashboardHome();
  const stats = dashboardHome?.stats;
  const selectedMonthLabel =
    PERIOD_OPTIONS.find((option) => option.value === selectedMonth)?.label ?? 'Mes actual';

  const data = useMemo((): DiaData[] => {
    const ingresosPorMes: IngresosMes[] = stats?.ingresosPorMes ?? [];
    const ingresosPorDia: IngresosDia[] = stats?.ingresosPorDia ?? [];
    const currentDate = new Date();
    if (selectedMonth === 'actual') {
      // Usar datos reales por día desde el read model SQL del dashboard.
      // Incluye días futuros del mes actual si tienen datos registrados
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const diaMap = new Map(ingresosPorDia.map(d => [d.dia, d]));

      return days.map((day) => {
        const diaKey = format(day, 'yyyy-MM-dd');
        const entry = diaMap.get(diaKey);
        return {
          dia: format(day, 'd', { locale: es }),
          fullDate: format(day, 'd MMM yyyy', { locale: es }),
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
        dia: format(month, 'MMM', { locale: es }),
        fullDate: format(month, 'MMMM yyyy', { locale: es }),
        ingresos: entry?.ingresos ?? 0,
        gastos: entry?.gastos ?? 0,
      };
    });
  }, [selectedMonth, stats]);

  const description =
    selectedMonth === 'actual'
      ? 'Comparativa diaria de ingresos por ventas y gastos del mes actual.'
      : `Comparativa de ingresos por ventas y gastos en los ${selectedMonthLabel.toLowerCase()}.`;

  return (
    <Panel
      title="Ingresos vs Gastos"
      description={description}
      className="min-h-0 flex-1"
      contentClassName="min-h-[240px]"
      fill
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="w-[168px] justify-between gap-2 font-normal">
              <FilterTriggerContent icon={CalendarClock} label={selectedMonthLabel} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="dashboard-toolbar-menu">
            {PERIOD_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => setSelectedMonth(option.value)}
                className="dashboard-toolbar-menu-item"
              >
                <span className="dashboard-toolbar-menu-item-label">{option.label}</span>
                {selectedMonth === option.value && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {isLoading ? (
        <Skeleton className="h-full w-full rounded-lg" />
      ) : (
        <ResponsiveContainer width="100%" height="100%" initialDimension={chartInitialDimension}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="fillIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.income} stopOpacity={0.22} />
                <stop offset="100%" stopColor={chartColors.income} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillGastos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.expense} stopOpacity={0.16} />
                <stop offset="100%" stopColor={chartColors.expense} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
            <XAxis
              dataKey="dia"
              stroke={chartColors.axis}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={selectedMonth === 'actual' ? 1 : 0}
              tick={{ fill: chartColors.axis }}
            />
            <YAxis
              stroke={chartColors.axis}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
              tick={{ fill: chartColors.axis }}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={chartTooltipLabelStyle}
              cursor={{ stroke: chartColors.grid }}
              itemSorter={(item) => (item.dataKey === 'ingresos' ? 0 : 1)}
              formatter={(value: number | undefined) => {
                if (value === undefined) return '';
                return `$${value.toFixed(2)}`;
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload.length > 0) {
                  const dateStr = payload[0].payload.fullDate;
                  return dateStr ? dateStr.charAt(0).toUpperCase() + dateStr.slice(1) : label;
                }
                return label;
              }}
              animationDuration={0}
            />
            <Legend
              verticalAlign="bottom"
              height={24}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
            />
            <Area
              type="monotone"
              dataKey="ingresos"
              stroke={chartColors.income}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#fillIngresos)"
              name="Ingresos"
              animationDuration={600}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="gastos"
              stroke={chartColors.expense}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#fillGastos)"
              name="Gastos"
              animationDuration={600}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
