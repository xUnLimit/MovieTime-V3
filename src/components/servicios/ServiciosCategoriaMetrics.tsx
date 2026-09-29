"use client";

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Monitor } from "lucide-react";

import { MetricCard } from "@/components/shared/MetricCard";
import { MetricGrid } from "@/components/shared/MetricGrid";
import { queryKeys } from "@/platform/query-keys";
import { countServiciosProximosPagoByCategoriaUseCase } from "@/application/use-cases/servicios/servicios-query-use-cases";
import { Categoria } from "@/types";

interface ServiciosCategoriaMetricsProps {
  categoria: Categoria | undefined;
}

export const ServiciosCategoriaMetrics = memo(
  function ServiciosCategoriaMetrics({
    categoria,
  }: ServiciosCategoriaMetricsProps) {
    const categoriaId = categoria?.id ?? null;
    const { data: proximosPagos = 0 } = useQuery({
      queryKey: queryKeys.servicios.proximosPagosByCategoria(categoriaId ?? 'invalid'),
      queryFn: async () => {
        const en7Dias = new Date();
        en7Dias.setDate(en7Dias.getDate() + 7);

        return countServiciosProximosPagoByCategoriaUseCase(categoriaId!, en7Dias);
      },
      enabled: Boolean(categoriaId),
    });

    if (!categoria) {
      return (
        <MetricGrid>
          <MetricCard
            title="Servicios Activos"
            value="0/0"
            icon={Monitor}
            tone="info"
          />
          <MetricCard
            title="Próximos Pagos (7 días)"
            value={0}
            icon={Calendar}
            tone="warning"
          />
        </MetricGrid>
      );
    }

    const totalServicios = categoria.totalServicios ?? 0;
    const serviciosActivos = categoria.serviciosActivos ?? 0;

    return (
      <MetricGrid>
        <MetricCard
          title="Servicios Activos"
          value={`${serviciosActivos}/${totalServicios}`}
          icon={Monitor}
          tone="info"
        />
        <MetricCard
          title="Próximos Pagos (7 días)"
          value={proximosPagos}
          icon={Calendar}
          tone="warning"
        />
      </MetricGrid>
    );
  },
);
