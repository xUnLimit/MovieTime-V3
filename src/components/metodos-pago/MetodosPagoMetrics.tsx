"use client";

import { memo } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { useMetodosPagoCounts } from "@/hooks/use-metodos-pago-counts";
import { CreditCard, Users, Package } from "lucide-react";

export const MetodosPagoMetrics = memo(function MetodosPagoMetrics() {
  const { data: counts } = useMetodosPagoCounts();
  const totalMetodos = counts?.totalMetodos ?? 0;
  const metodosTerceros = counts?.metodosTerceros ?? 0;
  const metodosServicios = counts?.metodosServicios ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <MetricCard
        title="Total Métodos"
        value={totalMetodos}
        icon={CreditCard}
        iconColor="text-blue-500"
        underlineColor="bg-blue-500"
      />
      <MetricCard
        title="Asociados a Terceros"
        value={metodosTerceros}
        icon={Users}
        iconColor="text-purple-500"
        underlineColor="bg-purple-500"
      />
      <MetricCard
        title="Asociados a Servicios"
        value={metodosServicios}
        icon={Package}
        iconColor="text-orange-500"
        underlineColor="bg-orange-500"
      />
    </div>
  );
});
