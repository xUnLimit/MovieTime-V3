'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import type { LabelProps } from 'recharts';
import { useDashboardStore } from '@/store/dashboardStore';
import { useDashboardFilterStore } from '@/store/dashboardFilterStore';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#14b8a6', // teal
];
const NEGATIVE_COLOR = '#dc2626';
const MIN_NEGATIVE_AXIS_RATIO = 0.05;
const MIN_NEGATIVE_AXIS_RATIO_MOBILE = 0.12;
const VALUE_LABEL_GAP = 8;
const COMPACT_CHART_QUERY = '(max-width: 640px)';

type Vista = 'ganancia' | 'margen';

const VISTAS: Array<{
  id: Vista;
  title: string;
  description: string;
  tooltipLabel: string;
}> = [
  {
    id: 'ganancia',
    title: 'Ganancia Neta por Categoría',
    description: 'Ganancia neta generada por cada categoría de servicio.',
    tooltipLabel: 'Ganancia neta',
  },
  {
    id: 'margen',
    title: 'Rentabilidad por Categoría',
    description: 'Margen porcentual de ganancia sobre los ingresos de cada categoría.',
    tooltipLabel: 'Rentabilidad',
  },
];

function subscribeToCompactChart(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(COMPACT_CHART_QUERY);
  mediaQuery.addEventListener('change', callback);

  return () => mediaQuery.removeEventListener('change', callback);
}

function getIsCompactChart() {
  return typeof window !== 'undefined' && window.matchMedia(COMPACT_CHART_QUERY).matches;
}

function useIsCompactChart() {
  return useSyncExternalStore(subscribeToCompactChart, getIsCompactChart, () => false);
}

function getValueDomain(data: Array<{ valor: number }>, minNegativeAxisRatio: number): [number, number] {
  const maxPositive = Math.max(0, ...data.map((entry) => entry.valor));
  const minNegative = Math.min(0, ...data.map((entry) => entry.valor));

  if (minNegative >= 0) {
    return [0, maxPositive];
  }

  if (maxPositive <= 0) {
    return [minNegative, 0];
  }

  const visibleNegativeRange = Math.max(Math.abs(minNegative), maxPositive * minNegativeAxisRatio);

  return [-visibleNegativeRange, maxPositive];
}

export function RevenueByCategory() {
  const { stats, isLoading } = useDashboardStore();
  const { selectedYear } = useDashboardFilterStore();
  const isCompactChart = useIsCompactChart();

  const [vistaIndex, setVistaIndex] = useState(0);
  const [animacionFase, setAnimacionFase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [animacionDireccion, setAnimacionDireccion] = useState<1 | -1>(1);
  const animationTimerRef = useRef<number | null>(null);

  const vista = VISTAS[vistaIndex];
  const totalVistas = VISTAS.length;
  const puedeIrAtras = vistaIndex > 0;
  const puedeIrAdelante = vistaIndex < totalVistas - 1;

  const axisColor = 'var(--muted-foreground)';
  const labelColor = 'var(--foreground)';
  const tooltipBg = 'var(--background)';
  const tooltipBorder = 'var(--border)';
  const tooltipText = 'var(--foreground)';

  const { data, hasData } = useMemo(() => {
    const cutoff = `${selectedYear}-01`;
    const porMes = stats?.ingresosCategoriasPorMes ?? [];

    const totalesPorCategoria = new Map<string, { nombre: string; total: number; gastos: number }>();
    const filteredMeses = porMes.filter((e) => e.mes >= cutoff);

    if (filteredMeses.length > 0) {
      for (const entry of filteredMeses) {
        const existing = totalesPorCategoria.get(entry.categoriaId);
        if (existing) {
          existing.total += entry.total;
          existing.gastos += entry.gastos;
        } else {
          totalesPorCategoria.set(entry.categoriaId, {
            nombre: entry.nombre,
            total: entry.total,
            gastos: entry.gastos,
          });
        }
      }
    } else {
      for (const c of (stats?.ingresosPorCategoria ?? [])) {
        totalesPorCategoria.set(c.categoriaId, {
          nombre: c.nombre,
          total: c.total,
          gastos: c.gastos ?? 0,
        });
      }
    }

    const mapped = Array.from(totalesPorCategoria.values()).map((c) => {
      const ganancia = c.total - c.gastos;
      const margen = c.total > 0 ? (ganancia / c.total) * 100 : 0;
      return {
        categoria: c.nombre,
        ganancia: Math.round(ganancia),
        margen: Math.round(margen * 10) / 10,
        ingresos: c.total,
      };
    });

    const valor = vista.id === 'ganancia' ? 'ganancia' : 'margen';
    const filtered = mapped
      .filter((c) => c.ingresos > 0 && c[valor] !== 0)
      .map((c) => ({ ...c, valor: c[valor] }));
    const hasData = filtered.length > 0;
    const data = filtered.sort((a, b) => b.valor - a.valor);
    return { data, hasData };
  }, [stats, selectedYear, vista]);

  const valueDomain = useMemo(
    () => getValueDomain(data, isCompactChart ? MIN_NEGATIVE_AXIS_RATIO_MOBILE : MIN_NEGATIVE_AXIS_RATIO),
    [data, isCompactChart]
  );
  const chartHeight = isCompactChart ? 250 : 220;
  const chartMargin = isCompactChart
    ? { left: 0, right: 34, top: 8, bottom: 0 }
    : { left: 0, right: 50, top: 5, bottom: 5 };
  const yAxisWidth = isCompactChart ? 88 : 108;
  const yAxisTickMargin = isCompactChart ? 8 : 10;
  const valueLabelFontSize = isCompactChart ? 11 : 12;
  const xAxisTickCount = isCompactChart ? 3 : 5;

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

  const formatValue = (value: number) =>
    vista.id === 'ganancia' ? `$${value.toLocaleString()}` : `${value.toFixed(1)}%`;

  const renderValueLabel = (props: LabelProps) => {
    const xNum = Number(props.x);
    const yNum = Number(props.y);
    const widthNum = Number(props.width);
    const heightNum = Number(props.height);
    const numericValue = typeof props.value === 'number' ? props.value : Number(props.value ?? 0);
    if (!Number.isFinite(xNum) || !Number.isFinite(yNum) || !Number.isFinite(widthNum) || !Number.isFinite(heightNum)) {
      return '';
    }
    const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
    const isNegative = safeValue < 0;

    const barEnd = Math.max(xNum, xNum + widthNum);
    const barStart = Math.min(xNum, xNum + widthNum);
    const labelX = isNegative ? barStart - VALUE_LABEL_GAP : barEnd + VALUE_LABEL_GAP;
    const labelY = yNum + heightNum / 2 + 4;

    return (
      <text
        x={labelX}
        y={labelY}
        fill={isNegative ? NEGATIVE_COLOR : labelColor}
        stroke={tooltipBg}
        strokeWidth={3}
        paintOrder="stroke"
        fontSize={valueLabelFontSize}
        fontWeight={700}
        textAnchor={isNegative ? 'end' : 'start'}
      >
        {formatValue(safeValue)}
      </text>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{vista.title}</CardTitle>
            <CardDescription className="text-sm">{vista.description}</CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
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
        </div>
      </CardHeader>
      <CardContent className="pt-1 h-[260px] sm:h-[220px]">
        {isLoading ? (
          <Skeleton className="w-full h-full rounded-lg" />
        ) : !hasData ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
          </div>
        ) : (
          <div className={`w-full h-full transition-all duration-200 ease-out will-change-transform ${animationClass}`}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={data} layout="vertical" margin={chartMargin}>
                <XAxis
                  type="number"
                  domain={valueDomain}
                  allowDecimals={vista.id === 'margen'}
                  tickCount={xAxisTickCount}
                  stroke={axisColor}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    vista.id === 'ganancia'
                      ? `$${Math.round(Number(value))}`
                      : `${Math.round(Number(value))}%`
                  }
                  tick={{ fill: axisColor }}
                />
                <YAxis
                  type="category"
                  dataKey="categoria"
                  stroke={labelColor}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  width={yAxisWidth}
                  tickMargin={yAxisTickMargin}
                  tick={{ fill: labelColor }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: '6px',
                    color: tooltipText,
                  }}
                  labelStyle={{ color: tooltipText }}
                  itemStyle={{ color: tooltipText }}
                  wrapperStyle={{ maxWidth: isCompactChart ? 180 : undefined }}
                  formatter={(value: number | undefined) => {
                    const v = value ?? 0;
                    const formatted =
                      vista.id === 'ganancia'
                        ? `$${v.toFixed(2)} USD`
                        : `${v.toFixed(1)}%`;
                    return [formatted, vista.tooltipLabel];
                  }}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                />
                <Bar
                  dataKey="valor"
                  radius={[0, 12, 12, 0]}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                  barSize={20}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.valor < 0 ? NEGATIVE_COLOR : COLORS[index % COLORS.length]}
                    />
                  ))}
                  <LabelList dataKey="valor" content={renderValueLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
