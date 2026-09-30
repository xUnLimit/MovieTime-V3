import { useEffect, useRef } from "react";
import { addMonths } from "date-fns";
import type { UseFormSetValue } from "react-hook-form";
import { getCycleMonths } from '@/platform/constants';

import type { VentaEditFormData } from "@/components/ventas/form/venta-edit-form-schema";
import type { Plan } from "@/types";

interface UseVentaEditPlanPricingParams {
  setValue: UseFormSetValue<VentaEditFormData>;
  planSeleccionado?: Plan;
  planesDisponibles: Plan[];
  planIdValue: string;
  fechaInicioValue?: Date;
  fechaFinValue?: Date;
  ventaPrecio: number;
  ventaCicloPago?: Plan["cicloPago"];
}

export function useVentaEditPlanPricing({
  setValue,
  planSeleccionado,
  planesDisponibles,
  planIdValue,
  fechaInicioValue,
  fechaFinValue,
  ventaPrecio,
  ventaCicloPago,
}: UseVentaEditPlanPricingParams) {
  const precioInicializadoRef = useRef(false);
  const planInicializadoRef = useRef(false);
  const lastPlanIdRef = useRef<string | null>(null);
  const lastFechaInicioTimeRef = useRef<number | null>(null);
  const fechasInicializadasRef = useRef(false);

  useEffect(() => {
    if (!precioInicializadoRef.current && ventaPrecio > 0) {
      setValue("precio", ventaPrecio.toFixed(2));
      precioInicializadoRef.current = true;
    }
  }, [ventaPrecio, setValue]);

  useEffect(() => {
    if (!planSeleccionado) return;

    const planCambio =
      lastPlanIdRef.current !== null && lastPlanIdRef.current !== planIdValue;

    if (planCambio || !precioInicializadoRef.current) {
      setValue("precio", planSeleccionado.precio.toFixed(2));
    }
  }, [planSeleccionado, setValue, planIdValue]);

  useEffect(() => {
    if (
      fechaInicioValue &&
      fechaFinValue &&
      !fechasInicializadasRef.current
    ) {
      lastFechaInicioTimeRef.current = fechaInicioValue.getTime();
      fechasInicializadasRef.current = true;
    }
  }, [fechaInicioValue, fechaFinValue]);

  useEffect(() => {
    if (!planSeleccionado || !fechaInicioValue || !fechasInicializadasRef.current) return;

    const planCambio =
      lastPlanIdRef.current !== null && lastPlanIdRef.current !== planIdValue;
    const fechaInicioCambio =
      lastFechaInicioTimeRef.current !== null &&
      lastFechaInicioTimeRef.current !== fechaInicioValue.getTime();

    if (planCambio || fechaInicioCambio) {
      const meses = getCycleMonths(planSeleccionado.cicloPago);
      const fechaCalculada = addMonths(new Date(fechaInicioValue), meses);
      setValue("fechaFin", fechaCalculada);
    }

    if (planCambio) lastPlanIdRef.current = planIdValue;
    if (fechaInicioCambio)
      lastFechaInicioTimeRef.current = fechaInicioValue.getTime();
  }, [
    planSeleccionado,
    fechaInicioValue,
    setValue,
    planIdValue,
  ]);

  useEffect(() => {
    if (
      !planInicializadoRef.current &&
      planesDisponibles.length > 0 &&
      ventaCicloPago
    ) {
      const match = planesDisponibles.find(
        (plan) => plan.cicloPago === ventaCicloPago,
      );
      if (match) {
        setValue("planId", match.id);
        lastPlanIdRef.current = match.id;
        planInicializadoRef.current = true;
      } else if (!planIdValue) {
        setValue("planId", planesDisponibles[0].id);
        lastPlanIdRef.current = planesDisponibles[0].id;
        planInicializadoRef.current = true;
      }
    }
  }, [
    planesDisponibles,
    planIdValue,
    setValue,
    ventaCicloPago,
  ]);
}
