"use client";

import {
  useCallback,
  useMemo,
  useState,
  type WheelEvent,
} from "react";

import {
  SERVICIOS_DROPDOWN_VISIBLE_ROWS,
  type VentaItem,
} from "@/features/ventas/ventas-form-shared";
import { rankServicios } from "@/lib/utils/servicioRanking";
import type { Plan, Servicio } from "@/types";

import {
  getPerfilesDropdown,
  getPerfilesUsados,
  getServiciosDropdownWindow,
  getSlotsDisponiblesForServicio,
} from "./venta-create-controller-helpers";
import { useVentasActivasByServicio } from "../useVentaFormQueries";

interface UseVentaCreateServicioRankingStateParams {
  fechaFin?: Date;
  fechaInicio?: Date;
  items: VentaItem[];
  planSeleccionado?: Plan;
  servicioId: string;
  servicioSeleccionado?: Servicio;
  serviciosCategoria: Servicio[];
  serviciosOrdenados: Servicio[];
}

export function useVentaCreateServicioRankingState({
  fechaFin,
  fechaInicio,
  items,
  planSeleccionado,
  servicioId,
  servicioSeleccionado,
  serviciosCategoria,
  serviciosOrdenados,
}: UseVentaCreateServicioRankingStateParams) {
  const [serviciosWindowStart, setServiciosWindowStart] = useState(0);
  const perfilesUsados = useMemo(() => getPerfilesUsados(items), [items]);

  const servicioRankingCandidateIds = useMemo(() => {
    if (!planSeleccionado) return [];
    return serviciosCategoria
      .filter(
        (servicio) =>
          servicio.activo &&
          !servicio.enReposo &&
          servicio.tipo === planSeleccionado.tipoPlan,
      )
      .map((servicio) => servicio.id);
  }, [planSeleccionado, serviciosCategoria]);

  const {
    ventasActivasPorServicio,
    perfilesOcupadosVenta,
    isLoading: loadingVentasRanking,
  } = useVentasActivasByServicio(servicioRankingCandidateIds);

  const serviciosFiltradosPorTipo = useMemo(() => {
    if (!planSeleccionado) return [];
    return serviciosOrdenados.filter((servicio) => {
      if (!servicio.activo || servicio.enReposo) return false;
      if (servicio.tipo !== planSeleccionado.tipoPlan) return false;
      const ocupadosActual =
        perfilesOcupadosVenta[servicio.id]?.size ?? servicio.perfilesOcupados ?? 0;
      const ocupadosEnVenta = perfilesUsados[servicio.id]?.size || 0;
      const disponibles =
        (servicio.perfilesDisponibles || 0) - ocupadosActual - ocupadosEnVenta;
      return disponibles > 0;
    });
  }, [perfilesOcupadosVenta, perfilesUsados, planSeleccionado, serviciosOrdenados]);

  const serviciosRankeados = useMemo(
    () =>
      rankServicios(serviciosFiltradosPorTipo, ventasActivasPorServicio, {
        planCicloPago: planSeleccionado?.cicloPago ?? "mensual",
        fechaInicio: fechaInicio ?? new Date(),
        fechaFin,
      }),
    [
      fechaFin,
      fechaInicio,
      planSeleccionado,
      serviciosFiltradosPorTipo,
      ventasActivasPorServicio,
    ],
  );

  const maxServiciosWindowStart = useMemo(
    () =>
      Math.max(serviciosRankeados.length - SERVICIOS_DROPDOWN_VISIBLE_ROWS, 0),
    [serviciosRankeados.length],
  );

  const normalizedServiciosWindowStart = Math.min(
    serviciosWindowStart,
    maxServiciosWindowStart,
  );

  const serviciosVentana = useMemo(
    () =>
      getServiciosDropdownWindow(
        serviciosRankeados,
        normalizedServiciosWindowStart,
      ),
    [normalizedServiciosWindowStart, serviciosRankeados],
  );

  const getSlotsDisponibles = (servicioIdValue: string) => {
    const servicio = serviciosCategoria.find((item) => item.id === servicioIdValue);
    return getSlotsDisponiblesForServicio({
      perfilesOcupadosVenta,
      perfilesUsados,
      servicio,
    });
  };

  const perfilesDropdown = useMemo(
    () =>
      getPerfilesDropdown({
        perfilesOcupadosVenta,
        perfilesUsados,
        servicioId,
        servicioSeleccionado,
      }),
    [
      perfilesOcupadosVenta,
      perfilesUsados,
      servicioId,
      servicioSeleccionado,
    ],
  );

  const scrollServiciosDropdown = useCallback(
    (direction: "up" | "down") => {
      setServiciosWindowStart((prev) => {
        if (direction === "up") return Math.max(prev - 1, 0);
        return Math.min(prev + 1, maxServiciosWindowStart);
      });
    },
    [maxServiciosWindowStart],
  );

  const handleServiciosDropdownWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY === 0) return;
      scrollServiciosDropdown(event.deltaY > 0 ? "down" : "up");
    },
    [scrollServiciosDropdown],
  );

  return {
    getSlotsDisponibles,
    handleServiciosDropdownWheel,
    loadingVentasRanking,
    perfilesDropdown,
    perfilesOcupadosVenta,
    perfilesUsados,
    scrollServiciosDropdown,
    serviciosRankeados,
    serviciosVentana,
  };
}
