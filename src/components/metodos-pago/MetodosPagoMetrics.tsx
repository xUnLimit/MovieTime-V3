"use client";

import { memo, useEffect } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import { CreditCard, Users, Package } from "lucide-react";

export const MetodosPagoMetrics = memo(function MetodosPagoMetrics() {
  const { totalMetodos, metodosUsuarios, metodosServicios, fetchCounts } =
    useMetodosPagoStore();

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

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
        title="Asociados a Usuarios"
        value={metodosUsuarios}
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
