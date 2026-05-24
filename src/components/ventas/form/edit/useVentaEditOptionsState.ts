"use client";

import { useMemo } from "react";

import type { Categoria, MetodoPago, Servicio, Tercero } from "@/types";

import {
  filterTercerosBySearch,
  sortPaymentMethods,
  sortTercerosByNewest,
} from "./venta-edit-controller-helpers";

interface UseVentaEditOptionsStateParams {
  categoriaId: string;
  categorias: Categoria[];
  clienteId: string;
  metodoPagoId: string;
  metodosPago: MetodoPago[];
  planId: string;
  searchCliente: string;
  servicioId: string;
  serviciosCategoria: Servicio[];
  terceros: Tercero[];
  tipoPlanId: string;
}

export function useVentaEditOptionsState({
  categoriaId,
  categorias,
  clienteId,
  metodoPagoId,
  metodosPago,
  planId,
  searchCliente,
  servicioId,
  serviciosCategoria,
  terceros,
  tipoPlanId,
}: UseVentaEditOptionsStateParams) {
  const tercerosOrdenados = useMemo(
    () => sortTercerosByNewest(terceros),
    [terceros],
  );

  const tercerosFiltrados = useMemo(
    () => filterTercerosBySearch(tercerosOrdenados, searchCliente),
    [tercerosOrdenados, searchCliente],
  );

  const categoriasOrdenadas = useMemo(
    () =>
      [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [categorias],
  );

  const metodosPagoOrdenados = useMemo(
    () => sortPaymentMethods(metodosPago),
    [metodosPago],
  );

  const clienteSeleccionado = tercerosOrdenados.find(
    (usuario) => usuario.id === clienteId,
  );

  const metodoPagoSeleccionado = metodosPagoOrdenados.find(
    (metodo) => metodo.id === metodoPagoId,
  );

  const categoriaSeleccionada = useMemo(
    () => categorias.find((categoria) => categoria.id === categoriaId),
    [categorias, categoriaId],
  );

  const servicioSeleccionado = useMemo(
    () => serviciosCategoria.find((servicio) => servicio.id === servicioId),
    [servicioId, serviciosCategoria],
  );

  const tipoPlanSeleccionadoId = useMemo(() => {
    if (tipoPlanId) return tipoPlanId;
    if (servicioSeleccionado?.tipo) return servicioSeleccionado.tipo;
    const tiposPlanes = categoriaSeleccionada?.tiposPlanes ?? [];
    return tiposPlanes.length === 1 ? tiposPlanes[0].id : "";
  }, [categoriaSeleccionada, servicioSeleccionado, tipoPlanId]);

  const planesDisponibles = useMemo(() => {
    const planes = categoriaSeleccionada?.planes ?? [];
    if (!tipoPlanSeleccionadoId) return planes;
    return planes.filter((plan) => plan.tipoPlan === tipoPlanSeleccionadoId);
  }, [categoriaSeleccionada, tipoPlanSeleccionadoId]);

  const planActualCategoria = useMemo(
    () => categoriaSeleccionada?.planes?.find((plan) => plan.id === planId),
    [categoriaSeleccionada, planId],
  );

  const planSeleccionado = useMemo(
    () => planesDisponibles.find((plan) => plan.id === planId),
    [planesDisponibles, planId],
  );

  return {
    categoriaSeleccionada,
    categoriasOrdenadas,
    clienteSeleccionado,
    metodoPagoSeleccionado,
    metodosPagoOrdenados,
    planActualCategoria,
    planesDisponibles,
    planSeleccionado,
    servicioSeleccionado,
    tercerosFiltrados,
    tipoPlanSeleccionadoId,
  };
}
