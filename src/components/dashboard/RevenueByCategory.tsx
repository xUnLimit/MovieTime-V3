'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

export function RevenueByCategory() {
  const { stats, isLoading } = useDashboardStore();
  const { selectedYear } = useDashboardFilterStore();
  const axisColor = 'var(--muted-foreground)';
  const labelColor = 'var(--foreground)';
  const tooltipBg = 'var(--background)';
  const tooltipBorder = 'var(--border)';
  const tooltipText = 'var(--foreground)';

  const { data, hasData } = useMemo(() => {
    const cutoff = `${selectedYear}-01`;
    const porMes = stats?.ingresosCategoriasPorMes ?? [];

    // Aggregate from per-month breakdown filtered by year
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
      // Fallback: use cumulative ingresosPorCategoria if no per-month data yet
      for (const c of (stats?.ingresosPorCategoria ?? [])) {
        totalesPorCategoria.set(c.categoriaId, {
          nombre: c.nombre,
          total: c.total,
          gastos: c.gastos ?? 0,
        });
      }
    }

    const mapped = Array.from(totalesPorCategoria.values()).map((c) => ({
      categoria: c.nombre,
      rentabilidad: Math.round(c.total - c.gastos),
    }));
    const filtered = mapped.filter((c) => c.rentabilidad !== 0);
    const hasData = filtered.length > 0;
    const data = filtered.sort((a, b) => b.rentabilidad - a.rentabilidad);
    return { data, hasData };
  }, [stats, selectedYear]);

  const renderRentabilidadLabel = (props: LabelProps) => {
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
    const labelX = isNegative ? barStart - 6 : barEnd + 6;
    const labelY = yNum + heightNum / 2 + 4;

    return (
      <text
        x={labelX}
        y={labelY}
        fill={isNegative ? NEGATIVE_COLOR : labelColor}
        fontSize={11}
        textAnchor={isNegative ? 'end' : 'start'}
      >
        {`$${safeValue.toLocaleString()}`}
      </text>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div>
          <CardTitle className="text-base">Rentabilidad por Categoría</CardTitle>
          <CardDescription className="text-sm">
            Ganancia neta generada por cada categoría de servicio.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-1 h-[220px]">
        {isLoading ? (
          <Skeleton className="w-full h-full rounded-lg" />
        ) : !hasData ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 50, top: 5, bottom: 5 }}>
              <XAxis
                type="number"
                stroke={axisColor}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
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
                width={90}
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
                formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)} USD`, 'Ganancia neta']}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
              />
              <Bar
                dataKey="rentabilidad"
                radius={[0, 12, 12, 0]}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
                barSize={20}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.rentabilidad < 0 ? NEGATIVE_COLOR : COLORS[index % COLORS.length]}
                  />
                ))}
                <LabelList
                  dataKey="rentabilidad"
                  content={renderRentabilidadLabel}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
