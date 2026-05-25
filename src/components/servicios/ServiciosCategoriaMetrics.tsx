"use client";

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Monitor } from "lucide-react";

import { MetricCard } from "@/components/shared/MetricCard";
import { queryKeys } from "@/lib/query-keys";
import { queryServicios } from "@/lib/supabase/servicios-repository";
import { Categoria, Servicio } from "@/types";

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

        const servicios = await queryServicios<Servicio>([
          { field: "categoriaId", operator: "==", value: categoriaId },
          { field: "fechaVencimiento", operator: "<=", value: en7Dias },
        ]);

        return servicios.length;
      },
      enabled: Boolean(categoriaId),
    });

    if (!categoria) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Servicios Activos"
            value="0/0"
            icon={Monitor}
            underlineColor="bg-blue-500"
            iconColor="text-blue-500"
          />
          <MetricCard
            title="Próximos Pagos (7 días)"
            value={0}
            icon={Calendar}
            underlineColor="bg-yellow-500"
            iconColor="text-yellow-500"
          />
        </div>
      );
    }

    const totalServicios = categoria.totalServicios ?? 0;
    const serviciosActivos = categoria.serviciosActivos ?? 0;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          title="Servicios Activos"
          value={`${serviciosActivos}/${totalServicios}`}
          icon={Monitor}
          underlineColor="bg-blue-500"
          iconColor="text-blue-500"
        />
        <MetricCard
          title="Próximos Pagos (7 días)"
          value={proximosPagos}
          icon={Calendar}
          underlineColor="bg-yellow-500"
          iconColor="text-yellow-500"
        />
      </div>
    );
  },
);
