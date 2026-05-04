"use client";

import { memo } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { Users, Store, UserCheck, UserPlus } from "lucide-react";

interface UsuariosMetricsProps {
  totalClientes: number;
  totalRevendedores: number;
  usuariosActivos: number;
  totalNuevosHoy: number;
}

export const UsuariosMetrics = memo(function UsuariosMetrics({
  totalClientes,
  totalRevendedores,
  usuariosActivos,
  totalNuevosHoy,
}: UsuariosMetricsProps) {
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
        title="Usuarios Activos"
        value={usuariosActivos}
        icon={UserCheck}
        iconColor="text-green-500"
        underlineColor="bg-green-500"
      />
      <MetricCard
        title="Usuarios Nuevos"
        value={totalNuevosHoy}
        icon={UserPlus}
        iconColor="text-purple-500"
        underlineColor="bg-purple-500"
      />
    </div>
  );
});
