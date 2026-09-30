"use client";

import { useEffect, useMemo } from "react";
import type { UseFormClearErrors, UseFormSetValue } from "react-hook-form";

import type { VentaEditFormData } from "@/components/ventas/form/venta-edit-form-schema";
import { getCurrencySymbol } from "@/platform/constants";
import {
  calculateDiscountedAmount,
  roundToDecimals,
} from "@/platform/utils/calculations";
import { getTerceroMetodoPagoMoneda } from "@/platform/utils/terceroMetodoPago";
import type { MetodoPago, Plan } from "@/types";

import { hasVentaEditChanges } from "./ventaEditChanges";
import { useVentaEditPlanPricing } from "./useVentaEditPlanPricing";

type VentaEditComputedBaseline = {
  categoriaId: string;
  cicloPago?: Plan["cicloPago"];
  clienteId: string;
  codigo?: string;
  descuento: number;
  estado?: "activo" | "inactivo";
  fechaFin: Date;
  fechaInicio: Date;
  metodoPagoId: string;
  moneda: string;
  notas?: string;
  perfilNombre?: string;
  perfilNumero?: number | null;
  precio: number;
  servicioId: string;
};

interface UseVentaEditComputedStateParams {
  clearErrors: UseFormClearErrors<VentaEditFormData>;
  codigo: string;
  categoriaId: string;
  clienteId: string;
  descuento: string;
  estado: "activo" | "inactivo";
  fechaFin: Date;
  fechaInicio: Date;
  metodoPagoId: string;
  metodoPagoSeleccionado?: Pick<MetodoPago, "moneda">;
  notas?: string;
  perfilNombre: string;
  perfilNumero: string;
  planActualCategoria?: Plan;
  planId: string;
  planesDisponibles: Plan[];
  planSeleccionado?: Plan;
  precio: string;
  servicioId: string;
  setValue: UseFormSetValue<VentaEditFormData>;
  venta: VentaEditComputedBaseline;
}

export function useVentaEditComputedState({
  clearErrors,
  codigo,
  categoriaId,
  clienteId,
  descuento,
  estado,
  fechaFin,
  fechaInicio,
  metodoPagoId,
  metodoPagoSeleccionado,
  notas,
  perfilNombre,
  perfilNumero,
  planActualCategoria,
  planId,
  planesDisponibles,
  planSeleccionado,
  precio,
  servicioId,
  setValue,
  venta,
}: UseVentaEditComputedStateParams) {
  useVentaEditPlanPricing({
    setValue,
    planSeleccionado,
    planesDisponibles,
    planIdValue: planId,
    fechaInicioValue: fechaInicio,
    fechaFinValue: fechaFin,
    ventaPrecio: venta.precio,
    ventaCicloPago: venta.cicloPago,
  });

  useEffect(() => {
    if (planesDisponibles.length === 0) return;
    const planEsCompatible = planesDisponibles.some((plan) => plan.id === planId);
    if (planEsCompatible) return;

    const cicloPreferido =
      planActualCategoria?.cicloPago ?? venta.cicloPago ?? "mensual";
    const siguientePlan =
      planesDisponibles.find((plan) => plan.cicloPago === cicloPreferido) ??
      planesDisponibles[0];

    if (siguientePlan) {
      setValue("planId", siguientePlan.id);
      clearErrors("planId");
    }
  }, [
    clearErrors,
    planActualCategoria?.cicloPago,
    planId,
    planesDisponibles,
    setValue,
    venta.cicloPago,
  ]);

  const simboloMoneda = getCurrencySymbol(
    getTerceroMetodoPagoMoneda(
      metodoPagoId,
      metodoPagoSeleccionado?.moneda || venta.moneda,
    ),
  );
  const precioBase = roundToDecimals(Number(precio) || 0);
  const descuentoNumero = roundToDecimals(Number(descuento) || 0);
  const precioFinal = calculateDiscountedAmount(precioBase, descuentoNumero);

  const hasChanges = useMemo(
    () =>
      hasVentaEditChanges({
        venta,
        values: {
          clienteId,
          metodoPagoId,
          categoriaId,
          servicioId,
          planId,
          perfilNumero,
          perfilNombre,
          precio,
          descuento,
          fechaInicio,
          fechaFin,
          codigo,
          estado,
          notas,
        },
        planSeleccionadoId: planSeleccionado?.id,
      }),
    [
      categoriaId,
      clienteId,
      codigo,
      descuento,
      estado,
      fechaFin,
      fechaInicio,
      metodoPagoId,
      notas,
      perfilNombre,
      perfilNumero,
      planId,
      planSeleccionado?.id,
      precio,
      servicioId,
      venta,
    ],
  );

  return {
    descuentoNumero,
    hasChanges,
    precioBase,
    precioFinal,
    simboloMoneda,
  };
}
