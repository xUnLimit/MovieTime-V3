'use client';

import { memo, useMemo } from 'react';
import { isSameMonth } from 'date-fns';
import { CalendarDays, Tags, TrendingDown } from 'lucide-react';
import { Gasto, TipoGasto } from '@/types';
import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';

function formatUSD(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface GastosMetricsProps {
  gastos: Gasto[];
  tiposGasto: TipoGasto[];
}

export const GastosMetrics = memo(function GastosMetrics({ gastos, tiposGasto }: GastosMetricsProps) {
  const { totalGastos, gastosMesActual, totalTiposGasto } = useMemo(() => {
    const now = new Date();
    return {
      totalGastos: gastos.reduce((sum, gasto) => sum + gasto.monto, 0),
      gastosMesActual: gastos
        .filter((gasto) => isSameMonth(gasto.fecha, now))
        .reduce((sum, gasto) => sum + gasto.monto, 0),
      totalTiposGasto: tiposGasto.length,
    };
  }, [gastos, tiposGasto]);

  return (
    <MetricGrid>
      <MetricCard
        title="Total de Gastos Registrados"
        value={formatUSD(totalGastos)}
        icon={TrendingDown}
        tone="danger"
      />
      <MetricCard
        title="Gastos del Mes Registrado"
        value={formatUSD(gastosMesActual)}
        icon={CalendarDays}
        tone="warning"
      />
      <MetricCard
        title="Tipos de Gastos"
        value={totalTiposGasto}
        icon={Tags}
        tone="brand"
      />
    </MetricGrid>
  );
});
