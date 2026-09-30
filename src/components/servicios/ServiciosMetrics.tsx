"use client";

import { memo } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { MetricGrid } from "@/components/shared/MetricGrid";
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
    <MetricGrid>
      <MetricCard
        title="Categorías"
        value={totalCategoriasActivas}
        icon={Tag}
        tone="brand"
      />
      <MetricCard
        title="Total Servicios"
        value={totalServicios}
        icon={Monitor}
        tone="info"
      />
      <MetricCard
        title="Servicios Activos"
        value={serviciosActivos}
        icon={CheckCircle}
        tone="success"
      />
      <MetricCard
        title="Total Suscripciones Activas"
        value={ventasActivas}
        icon={ShoppingBag}
        tone="warning"
      />
    </MetricGrid>
  );
});
