'use client';

import { useMemo } from 'react';
import { useDashboardFilterStore } from '@/store/dashboardFilterStore';
import { MetricCard } from '@/components/shared/MetricCard';
import { TrendingUp, TrendingDown, Wallet, CalendarClock, CalendarRange, RefreshCw } from 'lucide-react';
import { usePronosticoFinanciero } from '@/hooks/use-pronostico-financiero';
import { useDashboardHome } from '@/hooks/use-dashboard-home';
import { Button } from '@/components/ui/button';

function formatUSD(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DashboardMetrics() {
  const { data: dashboardHome, isLoading, error } = useDashboardHome();
  const stats = dashboardHome?.stats;
  const { selectedYear } = useDashboardFilterStore();
  const {
    meses,
    isLoading: isLoadingMensual,
    error: forecastError,
    retry: retryForecast,
  } = usePronosticoFinanciero();
  const gastoMensual = meses[0]?.gastos ?? null;
  const ingresoMensual = meses[0]?.ingresos ?? null;

  const { gastosTotal, ingresosTotal } = useMemo(() => {
    const cutoff = `${selectedYear}-01`;
    const filtered = (stats?.ingresosPorMes ?? []).filter((m) => m.mes >= cutoff);
    return {
      ingresosTotal: filtered.reduce((sum, m) => sum + (m.ingresos ?? 0), 0),
      gastosTotal: filtered.reduce((sum, m) => sum + (m.gastos ?? 0), 0),
    };
  }, [stats?.ingresosPorMes, selectedYear]);

  const gananciasTotal = ingresosTotal - gastosTotal;

  if (error) {
    return (
      <p className="text-sm text-red-500">
        Error al cargar métricas del dashboard. Intenta recargar la página.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {Boolean(forecastError) && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            Las métricas esperadas no están disponibles hasta obtener tasas de cambio válidas.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={retryForecast}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      <MetricCard
        title="Gastos Totales"
        value={isLoading ? '...' : formatUSD(gastosTotal)}
        description="Suma de todos los gastos registrados"
        icon={TrendingDown}
        iconColor="text-red-500"
        borderColor="border-l-red-500"
        loading={isLoading}
      />
      <MetricCard
        title="Ingresos Totales"
        value={isLoading ? '...' : formatUSD(ingresosTotal)}
        description="Suma de todas las ventas"
        icon={TrendingUp}
        iconColor="text-blue-500"
        borderColor="border-l-blue-500"
        loading={isLoading}
      />
      <MetricCard
        title="Ganancias Totales"
        value={isLoading ? '...' : formatUSD(gananciasTotal)}
        valueColor={isLoading ? undefined : gananciasTotal >= 0 ? 'text-green-500' : 'text-red-500'}
        description="Ingresos totales menos gastos totales"
        icon={Wallet}
        iconColor="text-green-500"
        borderColor="border-l-green-500"
        loading={isLoading}
      />
      <MetricCard
        title="Gastos Esperados del Mes"
        value={forecastError ? 'No disponible' : isLoadingMensual ? '...' : (gastoMensual !== null ? formatUSD(gastoMensual) : '$0.00')}
        description="Gastos a pagar este mes"
        icon={CalendarClock}
        iconColor="text-purple-500"
        borderColor="border-l-purple-500"
        loading={isLoadingMensual}
      />
      <MetricCard
        title="Ingresos Esperados del Mes"
        value={forecastError ? 'No disponible' : isLoadingMensual ? '...' : (ingresoMensual !== null ? formatUSD(ingresoMensual) : '$0.00')}
        description="Ingresos a recibir este mes"
        icon={CalendarRange}
        iconColor="text-orange-500"
        borderColor="border-l-orange-500"
        loading={isLoadingMensual}
      />
      </div>
    </div>
  );
}
