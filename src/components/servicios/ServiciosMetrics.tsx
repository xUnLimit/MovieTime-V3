"use client";

import { memo } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { Tag, Monitor, CheckCircle, ShoppingBag } from "lucide-react";
import { useServiciosCounts } from "@/hooks/use-servicios-counts";
import { useVentasCounts } from "@/hooks/use-ventas-counts";

export const ServiciosMetrics = memo(function ServiciosMetrics() {
  const { data: serviciosCounts } = useServiciosCounts();
  const { data: ventasCounts } = useVentasCounts();
  const totalServicios = serviciosCounts?.totalServicios ?? 0;
  const serviciosActivos = serviciosCounts?.serviciosActivos ?? 0;
  const totalCategoriasActivas = serviciosCounts?.totalCategoriasActivas ?? 0;
  const ventasActivas = ventasCounts?.ventasActivas ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Categorías"
        value={totalCategoriasActivas}
        icon={Tag}
        underlineColor="bg-red-500"
        iconColor="text-red-500"
      />
      <MetricCard
        title="Total Servicios"
        value={totalServicios}
        icon={Monitor}
        underlineColor="bg-blue-500"
        iconColor="text-blue-500"
      />
      <MetricCard
        title="Servicios Activos"
        value={serviciosActivos}
        icon={CheckCircle}
        underlineColor="bg-green-500"
        iconColor="text-green-500"
      />
      <MetricCard
        title="Total Suscripciones Activas"
        value={ventasActivas}
        icon={ShoppingBag}
        underlineColor="bg-purple-500"
        iconColor="text-purple-500"
      />
    </div>
  );
});
