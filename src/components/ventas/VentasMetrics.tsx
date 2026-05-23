"use client";

import { memo, useEffect } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { useDashboardStore } from "@/store/dashboardStore";
import {
  CreditCard,
  DollarSign,
  CalendarRange,
  Wallet,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useIngresoMensualEsperado } from "@/hooks/use-ingreso-mensual-esperado";
import { useMontoSinConsumirTotal } from "@/hooks/use-monto-sin-consumir-total";
import { useVentasCounts } from "@/hooks/use-ventas-counts";

export const VentasMetrics = memo(function VentasMetrics() {
  const { data: ventasCounts } = useVentasCounts();
  const totalVentas = ventasCounts?.totalVentas ?? 0;
  const ventasActivas = ventasCounts?.ventasActivas ?? 0;
  const ventasInactivas = ventasCounts?.ventasInactivas ?? 0;
  const dashboardStats = useDashboardStore((state) => state.stats);
  const fetchDashboardStats = useDashboardStore((state) => state.fetchDashboardStats);
  const { value: ingresoMensual, isLoading: isLoadingMensual } =
    useIngresoMensualEsperado();
  const { value: montoSinConsumir, isLoading: isLoadingMonto } =
    useMontoSinConsumirTotal();

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const ingresoTotal = dashboardStats?.ingresosTotal ?? null;

  const formatValue = (val: number | null, loading: boolean) => {
    if (loading || val === null) return "Calculando...";
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      <MetricCard
        title="Ventas Totales"
        value={totalVentas}
        icon={CreditCard}
        iconColor="text-purple-500"
        underlineColor="bg-purple-500"
      />
      <MetricCard
        title="Ingreso Total"
        value={formatValue(ingresoTotal, dashboardStats === null)}
        icon={DollarSign}
        iconColor="text-orange-500"
        underlineColor="bg-orange-500"
      />
      <MetricCard
        title="Ingresos Esperados del Mes"
        value={
          isLoadingMensual
            ? "Calculando..."
            : ingresoMensual !== null
              ? `$${ingresoMensual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "-"
        }
        icon={CalendarRange}
        iconColor="text-blue-500"
        underlineColor="bg-blue-500"
      />
      <MetricCard
        title="Monto Sin Consumir"
        value={formatValue(montoSinConsumir, isLoadingMonto)}
        icon={Wallet}
        iconColor="text-emerald-500"
        underlineColor="bg-emerald-500"
      />
      <MetricCard
        title="Ventas Activas"
        value={ventasActivas}
        icon={CheckCircle2}
        iconColor="text-green-500"
        underlineColor="bg-green-500"
      />
      <MetricCard
        title="Ventas Inactivas"
        value={ventasInactivas}
        icon={XCircle}
        iconColor="text-red-500"
        underlineColor="bg-red-500"
      />
    </div>
  );
});
