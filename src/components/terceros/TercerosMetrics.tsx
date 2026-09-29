"use client";

import { memo } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { MetricGrid } from "@/components/shared/MetricGrid";
import { useTercerosCounts } from "@/hooks/use-terceros-counts";
import { Users, Store, UserCheck, UserPlus } from "lucide-react";

export const TercerosMetrics = memo(function TercerosMetrics() {
  const { data: counts } = useTercerosCounts();
  const totalClientes = counts?.totalClientes ?? 0;
  const totalRevendedores = counts?.totalRevendedores ?? 0;
  const tercerosActivos = counts?.totalTercerosActivos ?? 0;
  const totalNuevosHoy = counts?.totalNuevosHoy ?? 0;
  return (
    <MetricGrid>
      <MetricCard
        title="Total Clientes"
        value={totalClientes}
        icon={Users}
        tone="neutral"
      />
      <MetricCard
        title="Total Revendedores"
        value={totalRevendedores}
        icon={Store}
        tone="neutral"
      />
      <MetricCard
        title="Terceros Activos"
        value={tercerosActivos}
        icon={UserCheck}
        tone="success"
      />
      <MetricCard
        title="Terceros Nuevos"
        value={totalNuevosHoy}
        icon={UserPlus}
        tone="neutral"
      />
    </MetricGrid>
  );
});
