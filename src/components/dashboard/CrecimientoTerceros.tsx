'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from 'recharts';
import type { LabelProps } from 'recharts';
import { subMonths, format, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDashboardStore } from '@/store/dashboardStore';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterTriggerContent } from '@/components/shared/FilterTriggerContent';
import type { TercerosMes, TercerosDia } from '@/types/dashboard';
import { Button } from '@/components/ui/button';
import { CalendarClock, Check, ChevronLeft, ChevronRight } from 'lucide-react';

const PERIOD_OPTIONS = [
  { value: 'actual', label: 'Mes actual' },
  { value: '3meses', label: 'Últimos 3 meses' },
  { value: '6meses', label: 'Últimos 6 meses' },
  { value: '12meses', label: 'Últimos 12 meses' },
];

const VISTAS = [
  { id: 'crecimiento', title: 'Terceros Nuevos' },
  { id: 'bajas', title: 'Clientes Perdidos' },
  { id: 'balance', title: 'Crecimiento Neto' },
] as const;

export function CrecimientoTerceros() {
  const [selectedPeriod, setSelectedPeriod] = useState('actual');
  const [vistaIndex, setVistaIndex] = useState(0);
  const [animacionFase, setAnimacionFase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [animacionDireccion, setAnimacionDireccion] = useState<1 | -1>(1);
  const animationTimerRef = useRef<number | null>(null);

  const { stats, isLoading } = useDashboardStore();
  const vista = VISTAS[vistaIndex];
  const totalVistas = VISTAS.length;
  const puedeIrAtras = vistaIndex > 0;
  const puedeIrAdelante = vistaIndex < totalVistas - 1;
  const selectedPeriodLabel =
    PERIOD_OPTIONS.find((option) => option.value === selectedPeriod)?.label ?? 'Mes actual';

  const axisColor = 'var(--muted-foreground)';
  const gridColor = 'var(--border)';
  const tooltipBg = 'var(--background)';
  const tooltipBorder = 'var(--border)';
  const tooltipText = 'var(--foreground)';

  const data = useMemo(() => {
    const tercerosPorMes: TercerosMes[] = stats?.tercerosPorMes ?? [];
    const tercerosPorDia: TercerosDia[] = stats?.tercerosPorDia ?? [];
    const currentDate = new Date();

    if (selectedPeriod === 'actual') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const today = new Date();
      const diaMap = new Map(tercerosPorDia.map(d => [d.dia, d]));

      return days.map((day) => {
        if (day > today) {
          return { dia: day.getDate().toString(), fullDate: format(day, 'd MMM yyyy', { locale: es }), clientes: 0, revendedores: 0 };
        }
        const diaKey = format(day, 'yyyy-MM-dd');
        const entry = diaMap.get(diaKey);
        return {
          dia: day.getDate().toString(),
          fullDate: format(day, 'd MMM yyyy', { locale: es }),
          clientes: entry?.clientes ?? 0,
          revendedores: entry?.revendedores ?? 0,
        };
      });
    }

    const monthsBack = selectedPeriod === '3meses' ? 3 : selectedPeriod === '6meses' ? 6 : 12;
    const startDate = subMonths(currentDate, monthsBack - 1);
    const months = eachMonthOfInterval({ start: startOfMonth(startDate), end: currentDate });
    const mesMap = new Map(tercerosPorMes.map(m => [m.mes, m]));

    return months.map((month) => {
      const mesKey = format(month, 'yyyy-MM');
      const entry = mesMap.get(mesKey);

      return {
        dia: format(month, 'MMM', { locale: es }),
        fullDate: format(month, 'MMMM yyyy', { locale: es }),
        clientes: entry?.clientes ?? 0,
        revendedores: entry?.revendedores ?? 0,
      };
    });
  }, [selectedPeriod, stats]);

  const churnData = useMemo(() => {
    const porMes = stats?.churnStats?.porMes ?? [];

    return porMes.map((entry) => {
      const monthDate = new Date(`${entry.mes}-01T00:00:00`);
      return {
        mes: format(monthDate, 'MMM', { locale: es }),
        fullDate: format(monthDate, 'MMMM yyyy', { locale: es }),
        perdidos: entry.perdidos,
        activosInicio: entry.activosInicio,
        churnPct: entry.churnPct,
      };
    });
  }, [stats]);

  const balanceData = useMemo(() => {
    const tercerosPorMes = stats?.tercerosPorMes ?? [];
    const altasPorMes = new Map(
      tercerosPorMes.map((entry) => [entry.mes, (entry.clientes ?? 0) + (entry.revendedores ?? 0)])
    );

    return (stats?.churnStats?.porMes ?? []).map((entry) => {
      const monthDate = new Date(`${entry.mes}-01T00:00:00`);
      return {
        mes: format(monthDate, 'MMM', { locale: es }),
        fullDate: format(monthDate, 'MMMM yyyy', { locale: es }),
        ganados: altasPorMes.get(entry.mes) ?? 0,
        perdidos: entry.perdidos,
      };
    });
  }, [stats]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  const navegar = (direction: 1 | -1) => {
    if (animacionFase !== 'idle') return;
    const siguienteIndex = vistaIndex + direction;
    if (siguienteIndex < 0 || siguienteIndex >= totalVistas) return;

    setAnimacionDireccion(direction);
    setAnimacionFase('exit');

    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
    }

    animationTimerRef.current = window.setTimeout(() => {
      setVistaIndex(siguienteIndex);
      setAnimacionFase('enter');
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setAnimacionFase('idle');
        });
      });
    }, 180);
  };

  const animationClass =
    animacionFase === 'exit'
      ? animacionDireccion === 1
        ? '-translate-x-3 opacity-0'
        : 'translate-x-3 opacity-0'
      : animacionFase === 'enter'
        ? animacionDireccion === 1
          ? 'translate-x-3 opacity-0'
          : '-translate-x-3 opacity-0'
        : 'translate-x-0 opacity-100';

  const renderChurnLabel = (props: LabelProps) => {
    const xNum = Number(props.x);
    const yNum = Number(props.y);
    const widthNum = Number(props.width);
    const value = Number(props.value ?? 0);

    if (!Number.isFinite(xNum) || !Number.isFinite(yNum) || !Number.isFinite(widthNum) || value <= 0) {
      return null;
    }

    return (
      <text
        x={xNum + widthNum / 2}
        y={yNum - 6}
        fill="#dc2626"
        stroke={tooltipBg}
        strokeWidth={3}
        paintOrder="stroke"
        fontSize={11}
        fontWeight={700}
        textAnchor="middle"
      >
        {`${value.toFixed(1)}%`}
      </text>
    );
  };

  const header = (
    <CardHeader className="flex flex-row items-start justify-between gap-2 pt-3 pb-2 px-6">
      <div className="space-y-0.5 min-w-0">
        <CardTitle className="text-base">{vista.title}</CardTitle>
        <CardDescription className="text-sm">
          {vista.id === 'crecimiento'
            ? selectedPeriod === 'actual'
              ? 'Clientes y revendedores nuevos por día en el mes actual.'
              : 'Clientes y revendedores nuevos por mes.'
            : vista.id === 'bajas'
              ? 'Clientes que perdieron su último servicio por mes.'
              : 'Terceros ganados frente a bajas registradas por mes.'}
        </CardDescription>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {vista.id === 'crecimiento' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-[140px] justify-between gap-2 text-xs font-normal"
              >
                <FilterTriggerContent icon={CalendarClock} label={selectedPeriodLabel} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
              {PERIOD_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => setSelectedPeriod(option.value)}
                  className="dashboard-toolbar-menu-item text-xs"
                >
                  <span className="dashboard-toolbar-menu-item-label">{option.label}</span>
                  {selectedPeriod === option.value && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="text-[11px] tabular-nums text-muted-foreground px-1">
          {vistaIndex + 1}/{totalVistas}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => navegar(-1)}
          disabled={!puedeIrAtras || isLoading || animacionFase !== 'idle'}
          aria-label="Vista anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => navegar(1)}
          disabled={!puedeIrAdelante || isLoading || animacionFase !== 'idle'}
          aria-label="Vista siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
  );

  return (
    <Card className="py-1">
      {header}
      <CardContent className="pt-0 px-6 pb-2">
        {isLoading ? (
          <Skeleton className="w-full h-[240px] rounded-lg" />
        ) : (
          <div className={`w-full h-[240px] transition-all duration-200 ease-out will-change-transform ${animationClass}`}>
            {vista.id === 'crecimiento' ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorClientes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.95}/>
                      <stop offset="50%" stopColor="#1e40af" stopOpacity={0.6}/>
                      <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.4}/>
                    </linearGradient>
                    <linearGradient id="colorRevendedores" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9}/>
                      <stop offset="50%" stopColor="#be185d" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="#4a0d25" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.2} />
                  <XAxis
                    dataKey="dia"
                    stroke={axisColor}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                    tick={{ fill: axisColor }}
                    interval={selectedPeriod === 'actual' ? 1 : 0}
                  />
                  <YAxis
                    stroke={axisColor}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    domain={[0, 'auto']}
                    width={35}
                    tick={{ fill: axisColor }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: '8px',
                    }}
                    formatter={(value: number | undefined, name: string | undefined) => {
                      const displayValue = value ?? 0;
                      if (name === 'clientes') return [displayValue, 'Clientes'];
                      if (name === 'revendedores') return [displayValue, 'Revendedores'];
                      return [displayValue, name ?? ''];
                    }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0) {
                        const dateStr = payload[0].payload.fullDate;
                        return dateStr ? dateStr.charAt(0).toUpperCase() + dateStr.slice(1) : label;
                      }
                      return label;
                    }}
                    labelStyle={{ color: tooltipText }}
                    animationDuration={0}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={30}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="clientes"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorClientes)"
                    name="Clientes"
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                  <Area
                    type="monotone"
                    dataKey="revendedores"
                    stroke="#ec4899"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevendedores)"
                    name="Revendedores"
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : vista.id === 'bajas' && churnData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No hay bajas disponibles</p>
              </div>
            ) : vista.id === 'bajas' ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={churnData} margin={{ top: 22, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.2} />
                  <XAxis
                    dataKey="mes"
                    stroke={axisColor}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                    tick={{ fill: axisColor }}
                    interval={0}
                  />
                  <YAxis
                    stroke={axisColor}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    domain={[0, 'auto']}
                    width={35}
                    tick={{ fill: axisColor }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: '8px',
                    }}
                    formatter={(value: number | undefined, name: string | undefined) => {
                      const displayValue = value ?? 0;
                      if (name === 'perdidos') return [displayValue, 'Clientes perdidos'];
                      if (name === 'churnPct') return [`${Number(displayValue).toFixed(2)}%`, 'Churn'];
                      if (name === 'activosInicio') return [displayValue, 'Activos al inicio'];
                      return [displayValue, name ?? ''];
                    }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0) {
                        const dateStr = payload[0].payload.fullDate;
                        return dateStr ? dateStr.charAt(0).toUpperCase() + dateStr.slice(1) : label;
                      }
                      return label;
                    }}
                    labelStyle={{ color: tooltipText }}
                    animationDuration={0}
                  />
                  <Bar
                    dataKey="perdidos"
                    fill="#dc2626"
                    radius={[8, 8, 0, 0]}
                    name="Clientes perdidos"
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    <LabelList dataKey="churnPct" content={renderChurnLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : balanceData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No hay datos de balance disponibles</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={balanceData} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.2} />
                  <XAxis
                    dataKey="mes"
                    stroke={axisColor}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                    tick={{ fill: axisColor }}
                    interval={0}
                  />
                  <YAxis
                    stroke={axisColor}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    domain={[0, 'auto']}
                    width={35}
                    tick={{ fill: axisColor }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: '8px',
                    }}
                    formatter={(value: number | undefined, name: string | undefined) => {
                      const displayValue = value ?? 0;
                      if (name === 'ganados') return [displayValue, 'Terceros ganados'];
                      if (name === 'perdidos') return [displayValue, 'Bajas registradas'];
                      return [displayValue, name ?? ''];
                    }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0) {
                        const dateStr = payload[0].payload.fullDate;
                        return dateStr ? dateStr.charAt(0).toUpperCase() + dateStr.slice(1) : label;
                      }
                      return label;
                    }}
                    labelStyle={{ color: tooltipText }}
                    animationDuration={0}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={30}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                  />
                  <Bar
                    dataKey="ganados"
                    fill="#16a34a"
                    radius={[8, 8, 0, 0]}
                    name="Ganados"
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                  <Bar
                    dataKey="perdidos"
                    fill="#dc2626"
                    radius={[8, 8, 0, 0]}
                    name="Perdidos"
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
