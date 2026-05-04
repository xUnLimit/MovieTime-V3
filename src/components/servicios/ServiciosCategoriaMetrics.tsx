"use client";

import { memo, useEffect, useState, useRef } from "react";
import { Categoria } from "@/types";
import { MetricCard } from "@/components/shared/MetricCard";
import { Monitor, Calendar } from "lucide-react";
import { queryDocuments, COLLECTIONS } from "@/lib/firebase/firestore";
import { Servicio } from "@/types";

interface ServiciosCategoriaMetricsProps {
  categoria: Categoria | undefined;
}

export const ServiciosCategoriaMetrics = memo(
  function ServiciosCategoriaMetrics({
    categoria,
  }: ServiciosCategoriaMetricsProps) {
    const [proximosPagos, setProximosPagos] = useState(0);
    const fetchingRef = useRef(false);

    useEffect(() => {
      if (!categoria || fetchingRef.current) return;

      const fetchProximosPagos = async () => {
        fetchingRef.current = true;
        try {
          const en7Dias = new Date();
          en7Dias.setDate(en7Dias.getDate() + 7);

          const servicios = await queryDocuments<Servicio>(
            COLLECTIONS.SERVICIOS,
            [
              { field: "categoriaId", operator: "==", value: categoria.id },
              { field: "fechaVencimiento", operator: "<=", value: en7Dias },
            ],
          );

          setProximosPagos(servicios.length);
        } catch (error) {
          console.error("Error fetching próximos pagos:", error);
          setProximosPagos(0);
        } finally {
          fetchingRef.current = false;
        }
      };

      fetchProximosPagos();
    }, [categoria]);

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
