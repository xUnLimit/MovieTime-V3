"use client";

import { memo } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { MetricGrid } from "@/components/shared/MetricGrid";
import {
  CreditCard,
  DollarSign,
  CalendarRange,
  Wallet,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useIngresoMensualEsperado } from "@/hooks/use-ingreso-mensual-esperado";
import { useMontoSinConsumirTotal } from "@/hooks/use-monto-sin-consumir-total";
import { useVentasCounts } from "@/hooks/use-ventas-counts";
import { formatearMoneda } from "@/platform/utils/calculations";

const money = (value: number | null) => (value === null ? "-" : formatearMoneda(value));

export const VentasMetrics = memo(function VentasMetrics() {
  const { data: ventasCounts, isLoading: isLoadingCounts } = useVentasCounts();
  const totalVentas = ventasCounts?.totalVentas ?? 0;
  const ventasActivas = ventasCounts?.ventasActivas ?? 0;
  const ventasInactivas = ventasCounts?.ventasInactivas ?? 0;
  const { data: dashboardStats, isLoading: isLoadingDashboardStats } =
    useDashboardStats();
  const { value: ingresoMensual, isLoading: isLoadingMensual } =
    useIngresoMensualEsperado();
  const { value: montoSinConsumir, isLoading: isLoadingMonto } =
    useMontoSinConsumirTotal();

  const ingresoTotal = dashboardStats?.ingresosTotal ?? null;

  return (
    <MetricGrid>
      <MetricCard
        title="Ventas Totales"
        value={totalVentas}
        icon={CreditCard}
        loading={isLoadingCounts}
      />
      <MetricCard
        title="Ingreso Total"
        value={money(ingresoTotal)}
        icon={DollarSign}
        loading={isLoadingDashboardStats}
      />
      <MetricCard
        title="Ingresos Esperados del Mes"
        value={money(ingresoMensual)}
        icon={CalendarRange}
        loading={isLoadingMensual}
      />
      <MetricCard
        title="Monto Sin Consumir"
        value={money(montoSinConsumir)}
        icon={Wallet}
        loading={isLoadingMonto}
      />
      <MetricCard
        title="Ventas Activas"
        value={ventasActivas}
        icon={CheckCircle2}
        tone="success"
        loading={isLoadingCounts}
      />
      <MetricCard
        title="Ventas Inactivas"
        value={ventasInactivas}
        icon={XCircle}
        tone="danger"
        loading={isLoadingCounts}
      />
    </MetricGrid>
  );
});
