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
import { subMonths, format, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDashboardStore } from '@/store/dashboardStore';
import { Skeleton } from '@/components/ui/skeleton';
import type { UsuariosMes, UsuariosDia } from '@/types/dashboard';

export function CrecimientoUsuarios() {
  const [selectedPeriod, setSelectedPeriod] = useState('actual');
  const { stats, isLoading } = useDashboardStore();
  const axisColor = 'var(--muted-foreground)';
  const gridColor = 'var(--border)';
  const tooltipBg = 'var(--background)';
  const tooltipBorder = 'var(--border)';
  const tooltipText = 'var(--foreground)';

  const data = useMemo(() => {
    const usuariosPorMes: UsuariosMes[] = stats?.usuariosPorMes ?? [];
    const usuariosPorDia: UsuariosDia[] = stats?.usuariosPorDia ?? [];
    const currentDate = new Date();

    if (selectedPeriod === 'actual') {
      // Usar datos reales por día desde dashboard_stats (0 reads extra)
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const today = new Date();
      const diaMap = new Map(usuariosPorDia.map(d => [d.dia, d]));

      return days.map((day) => {
        if (day > today) {
          return { dia: day.getDate().toString(), clientes: 0, revendedores: 0 };
        }
        const diaKey = format(day, 'yyyy-MM-dd');
        const entry = diaMap.get(diaKey);
        return {
          dia: day.getDate().toString(),
          clientes: entry?.clientes ?? 0,
          revendedores: entry?.revendedores ?? 0,
        };
      });
    }

    const monthsBack = selectedPeriod === '3meses' ? 3 : selectedPeriod === '6meses' ? 6 : 12;
    const startDate = subMonths(currentDate, monthsBack - 1);
    const months = eachMonthOfInterval({ start: startOfMonth(startDate), end: currentDate });
    const mesMap = new Map(usuariosPorMes.map(m => [m.mes, m]));

    return months.map((month) => {
      const mesKey = format(month, 'yyyy-MM');
      const entry = mesMap.get(mesKey);

      return {
        dia: format(month, 'MMM', { locale: es }),
        clientes: entry?.clientes ?? 0,
        revendedores: entry?.revendedores ?? 0,
      };
    });
  }, [selectedPeriod, stats]);

  const header = (
    <CardHeader className="flex flex-row items-center justify-between pt-3 pb-2 px-6">
      {/* pt-3 = padding arriba del título (12px, igual que Actividad Reciente) */}
      {/* pb-2 = espacio entre título y gráfica (8px) */}
      {/* px-6 = separación del borde izquierdo/derecho (24px) */}
      <div className="space-y-0.5">
        {/* space-y-0.5 = espacio mínimo entre título y descripción (2px, igual que Ingresos por Categoría) */}
        <CardTitle className="text-base">Crecimiento de Usuarios</CardTitle>
        <CardDescription className="text-sm">
          Nuevos clientes y revendedores adquiridos por mes.
        </CardDescription>
      </div>
      <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
        <SelectTrigger className="w-[140px] h-7 text-xs">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="actual">Mes actual</SelectItem>
          <SelectItem value="3meses">Últimos 3 meses</SelectItem>
          <SelectItem value="6meses">Últimos 6 meses</SelectItem>
          <SelectItem value="12meses">Últimos 12 meses</SelectItem>
        </SelectContent>
      </Select>
    </CardHeader>
  );

  return (
    <Card className="py-1"> {/* py-1 = padding vertical del Card (4px arriba + 4px abajo) */}
      {header}
      <CardContent className="pt-0 px-6 pb-2">
        {/* pt-0 = sin espacio arriba (gráfica pegada al título) */}
        {/* px-6 = separación del borde (24px) */}
        {/* pb-2 = espacio abajo de la gráfica (8px) */}
        {isLoading ? (
          <Skeleton className="w-full h-[240px] rounded-lg" />
        ) : (
        <ResponsiveContainer width="100%" height={240}>
          {/* height={240} = ALTURA DE LA GRÁFICA - aumentado para acercar leyenda al borde inferior */}
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {/* margin.left: 0 = sin margen negativo para que se vean los números del eje Y */}
            {/* margin.bottom: 0 = sin espacio abajo para pegar la leyenda */}
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
            {/* width={35} = ancho del eje Y para que quepan los números */}
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
              labelStyle={{ color: tooltipText }}
              animationDuration={0}
            />
            {/* Leyenda (Clientes / Revendedores) */}
            {/* verticalAlign="bottom" = posición abajo del todo */}
            {/* height={30} = altura reservada para la leyenda */}
            {/* iconType="circle" = iconos circulares (no cuadrados) */}
            {/* wrapperStyle = tamaño texto + separación arriba */}
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
        )}
      </CardContent>
    </Card>
  );
}
