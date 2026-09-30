'use client';

import { useMemo } from 'react';
import { useDashboardFilterStore } from '@/store/dashboardFilterStore';
import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';
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
      <p role="alert" className="text-sm text-danger">
        Error al cargar métricas del dashboard. Intenta recargar la página.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {Boolean(forecastError) && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-warning-border bg-warning-subtle px-3 py-2">
          <p className="text-sm text-muted-foreground">
            Las métricas esperadas no están disponibles hasta obtener tasas de cambio válidas.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={retryForecast}>
            <RefreshCw />
            Reintentar
          </Button>
        </div>
      )}
      <MetricGrid>
      <MetricCard
        title="Gastos Totales"
        value={isLoading ? '...' : formatUSD(gastosTotal)}
        valueTone={isLoading ? undefined : 'danger'}
        description="Suma de todos los gastos registrados"
        icon={TrendingDown}
        tone="danger"
        loading={isLoading}
      />
      <MetricCard
        title="Ingresos Totales"
        value={isLoading ? '...' : formatUSD(ingresosTotal)}
        valueTone={isLoading ? undefined : 'info'}
        description="Suma de todas las ventas"
        icon={TrendingUp}
        tone="info"
        loading={isLoading}
      />
      <MetricCard
        title="Ganancias Totales"
        value={isLoading ? '...' : formatUSD(gananciasTotal)}
        valueTone={isLoading ? undefined : gananciasTotal >= 0 ? 'success' : 'danger'}
        description="Ingresos totales menos gastos totales"
        icon={Wallet}
        tone="success"
        loading={isLoading}
      />
      <MetricCard
        title="Gastos Esperados del Mes"
        value={forecastError ? 'No disponible' : isLoadingMensual ? '...' : (gastoMensual !== null ? formatUSD(gastoMensual) : '$0.00')}
        valueTone={forecastError || isLoadingMensual ? undefined : 'danger'}
        description="Gastos a pagar este mes"
        icon={CalendarClock}
        tone="danger"
        loading={isLoadingMensual}
      />
      <MetricCard
        title="Ingresos Esperados del Mes"
        value={forecastError ? 'No disponible' : isLoadingMensual ? '...' : (ingresoMensual !== null ? formatUSD(ingresoMensual) : '$0.00')}
        valueTone={forecastError || isLoadingMensual ? undefined : 'info'}
        description="Ingresos a recibir este mes"
        icon={CalendarRange}
        tone="info"
        loading={isLoadingMensual}
      />
      </MetricGrid>
    </div>
  );
}
