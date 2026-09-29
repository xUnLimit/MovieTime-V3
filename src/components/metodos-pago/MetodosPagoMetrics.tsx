"use client";

import { memo } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { MetricGrid } from "@/components/shared/MetricGrid";
import { useMetodosPagoCounts } from "@/hooks/use-metodos-pago-counts";
import { CreditCard, Users, Package } from "lucide-react";

export const MetodosPagoMetrics = memo(function MetodosPagoMetrics() {
  const { data: counts } = useMetodosPagoCounts();
  const totalMetodos = counts?.totalMetodos ?? 0;
  const metodosTerceros = counts?.metodosTerceros ?? 0;
  const metodosServicios = counts?.metodosServicios ?? 0;

  return (
    <MetricGrid>
      <MetricCard
        title="Total Métodos"
        value={totalMetodos}
        icon={CreditCard}
        tone="info"
      />
      <MetricCard
        title="Asociados a Terceros"
        value={metodosTerceros}
        icon={Users}
        tone="neutral"
      />
      <MetricCard
        title="Asociados a Servicios"
        value={metodosServicios}
        icon={Package}
        tone="neutral"
      />
    </MetricGrid>
  );
});
