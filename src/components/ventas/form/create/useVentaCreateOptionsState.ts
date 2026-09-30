"use client";

import { useMemo } from "react";

import type {
  MetodoPagoTerceroOption,
  TipoVentaItem,
} from "@/components/ventas/form/ventas-form-shared";
import type { Categoria, Servicio, Tercero } from "@/types";

import {
  filterTercerosBySearch,
  sortPaymentMethods,
  sortServiciosByNewest,
  sortTercerosByNewest,
} from "./venta-create-controller-helpers";

interface UseVentaCreateOptionsStateParams {
  categoriaId: string;
  categorias: Categoria[];
  clienteId: string;
  metodoPagoId: string;
  metodosPagoTerceros: MetodoPagoTerceroOption[];
  planId: string;
  searchCliente: string;
  servicioId: string;
  serviciosCategoria: Servicio[];
  terceros: Tercero[];
  tipoPlanId: string;
}

export function useVentaCreateOptionsState({
  categoriaId,
  categorias,
  clienteId,
  metodoPagoId,
  metodosPagoTerceros,
  planId,
  searchCliente,
  servicioId,
  serviciosCategoria,
  terceros,
  tipoPlanId,
}: UseVentaCreateOptionsStateParams) {
  const categoriaSeleccionada = useMemo(
    () => categorias.find((categoria) => categoria.id === categoriaId),
    [categorias, categoriaId],
  );

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
    () => sortPaymentMethods(metodosPagoTerceros),
    [metodosPagoTerceros],
  );

  const clienteSeleccionado = tercerosOrdenados.find(
    (tercero) => tercero.id === clienteId,
  );
  const metodoPagoSeleccionado = metodosPagoTerceros.find(
    (metodo) => metodo.id === metodoPagoId,
  );
  const servicioSeleccionado = serviciosCategoria.find(
    (servicio) => servicio.id === servicioId,
  );

  const planesDisponibles = useMemo(() => {
    const planes = categoriaSeleccionada?.planes ?? [];
    if (!tipoPlanId) return planes;
    return planes.filter((plan) => plan.tipoPlan === tipoPlanId);
  }, [categoriaSeleccionada, tipoPlanId]);

  const planSeleccionado = useMemo(
    () =>
      categoriaSeleccionada?.planes?.find((plan) => plan.id === planId) ??
      undefined,
    [categoriaSeleccionada, planId],
  );

  const tipoItem = useMemo<TipoVentaItem | null>(() => {
    if (!planSeleccionado) return null;
    return "perfil";
  }, [planSeleccionado]);

  const serviciosOrdenados = useMemo(
    () => sortServiciosByNewest(serviciosCategoria),
    [serviciosCategoria],
  );

  return {
    categoriaSeleccionada,
    categoriasOrdenadas,
    clienteSeleccionado,
    metodoPagoSeleccionado,
    metodosPagoOrdenados,
    planesDisponibles,
    planSeleccionado,
    servicioSeleccionado,
    serviciosOrdenados,
    tercerosFiltrados,
    tercerosOrdenados,
    tipoItem,
  };
}
