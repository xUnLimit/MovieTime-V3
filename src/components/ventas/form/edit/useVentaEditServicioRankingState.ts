"use client";

import {
  useCallback,
  useMemo,
  useState,
  type WheelEvent,
} from "react";

import { SERVICIOS_DROPDOWN_VISIBLE_ROWS } from "@/features/ventas/ventas-form-shared";
import type { Plan, Servicio, VentaDoc } from "@/types";

import { useVentasActivasByServicio } from "../useVentaFormQueries";
import {
  getPerfilesDropdownForEdit,
  getServicioRankingCandidateIds,
  getServiciosOrdenadosForEdit,
  getSlotsDisponiblesForEdit,
} from "./venta-edit-controller-helpers";

interface UseVentaEditServicioRankingStateParams {
  fechaFin: Date;
  fechaInicio: Date;
  planParaRanking?: Plan;
  servicioId: string;
  servicioSeleccionado?: Servicio;
  serviciosCategoria: Servicio[];
  tipoPlanRanking: string | null;
  venta: Pick<
    VentaDoc,
    "cicloPago" | "fechaFin" | "fechaInicio" | "id" | "servicioId"
  >;
}

export function useVentaEditServicioRankingState({
  fechaFin,
  fechaInicio,
  planParaRanking,
  servicioId,
  servicioSeleccionado,
  serviciosCategoria,
  tipoPlanRanking,
  venta,
}: UseVentaEditServicioRankingStateParams) {
  const [serviciosWindowStart, setServiciosWindowStart] = useState(0);

  const servicioRankingCandidateIds = useMemo(() => {
    return getServicioRankingCandidateIds({
      servicios: serviciosCategoria,
      tipoPlanRanking,
      ventaServicioId: venta.servicioId,
    });
  }, [serviciosCategoria, tipoPlanRanking, venta.servicioId]);

  const {
    ventasActivasPorServicio,
    perfilesOcupadosVenta,
    isLoading: loadingVentasRanking,
  } = useVentasActivasByServicio(servicioRankingCandidateIds, {
    excludeVentaId: venta.id,
  });

  const serviciosOrdenados = useMemo(
    () =>
      getServiciosOrdenadosForEdit({
        fechaFin: fechaFin ?? venta.fechaFin,
        fechaInicio: fechaInicio ?? venta.fechaInicio,
        perfilesOcupadosVenta,
        planCicloPago: planParaRanking?.cicloPago ?? venta.cicloPago ?? "mensual",
        servicios: serviciosCategoria,
        tipoPlanRanking,
        venta,
        ventasActivasPorServicio,
      }),
    [
      fechaFin,
      fechaInicio,
      perfilesOcupadosVenta,
      planParaRanking,
      serviciosCategoria,
      tipoPlanRanking,
      venta,
      ventasActivasPorServicio,
    ],
  );

  const maxServiciosWindowStart = useMemo(
    () =>
      Math.max(serviciosOrdenados.length - SERVICIOS_DROPDOWN_VISIBLE_ROWS, 0),
    [serviciosOrdenados.length],
  );

  const normalizedServiciosWindowStart = Math.min(
    serviciosWindowStart,
    maxServiciosWindowStart,
  );

  const serviciosVentana = useMemo(
    () =>
      serviciosOrdenados.slice(
        normalizedServiciosWindowStart,
        normalizedServiciosWindowStart + SERVICIOS_DROPDOWN_VISIBLE_ROWS,
      ),
    [normalizedServiciosWindowStart, serviciosOrdenados],
  );

  const getSlotsDisponibles = useCallback(
    (currentServicioId: string) => {
      return getSlotsDisponiblesForEdit({
        perfilesOcupadosVenta,
        servicioId: currentServicioId,
        servicios: serviciosCategoria,
      });
    },
    [serviciosCategoria, perfilesOcupadosVenta],
  );

  const perfilesDropdown = useMemo(
    () =>
      getPerfilesDropdownForEdit({
        perfilesOcupadosVenta,
        servicioId,
        servicioSeleccionado,
      }),
    [perfilesOcupadosVenta, servicioId, servicioSeleccionado],
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
    scrollServiciosDropdown,
    serviciosOrdenados,
    serviciosVentana,
  };
}
