"use client";

import { memo } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { useTercerosCounts } from "@/hooks/use-terceros-counts";
import { Users, Store, UserCheck, UserPlus } from "lucide-react";

export const TercerosMetrics = memo(function TercerosMetrics() {
  const { data: counts } = useTercerosCounts();
  const totalClientes = counts?.totalClientes ?? 0;
  const totalRevendedores = counts?.totalRevendedores ?? 0;
  const tercerosActivos = counts?.totalTercerosActivos ?? 0;
  const totalNuevosHoy = counts?.totalNuevosHoy ?? 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Clientes"
        value={totalClientes}
        icon={Users}
        iconColor="text-purple-500"
        underlineColor="bg-purple-500"
      />
      <MetricCard
        title="Total Revendedores"
        value={totalRevendedores}
        icon={Store}
        iconColor="text-orange-500"
        underlineColor="bg-orange-500"
      />
      <MetricCard
        title="Terceros Activos"
        value={tercerosActivos}
        icon={UserCheck}
        iconColor="text-green-500"
        underlineColor="bg-green-500"
      />
      <MetricCard
        title="Terceros Nuevos"
        value={totalNuevosHoy}
        icon={UserPlus}
        iconColor="text-purple-500"
        underlineColor="bg-purple-500"
      />
    </div>
  );
});
