'use client';

import { memo, useMemo } from 'react';
import { isSameMonth } from 'date-fns';
import { Receipt, Tags, TrendingDown } from 'lucide-react';
import { Gasto, TipoGasto } from '@/types';
import { MetricCard } from '@/components/shared/MetricCard';

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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <MetricCard
        title="Total de Gastos Registrados"
        value={formatUSD(totalGastos)}
        icon={TrendingDown}
        iconColor="text-red-500"
        underlineColor="bg-red-500"
      />
      <MetricCard
        title="Gastos del Mes Registrado"
        value={formatUSD(gastosMesActual)}
        icon={Receipt}
        iconColor="text-orange-500"
        underlineColor="bg-orange-500"
      />
      <MetricCard
        title="Tipos de Gastos"
        value={totalTiposGasto}
        icon={Tags}
        iconColor="text-blue-500"
        underlineColor="bg-blue-500"
      />
    </div>
  );
});
