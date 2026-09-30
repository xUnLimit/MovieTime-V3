"use client";

import { useEffect, useRef } from "react";
import { addMonths } from "date-fns";
import type { UseFormGetValues, UseFormSetValue } from "react-hook-form";

import type { ServicioFormData } from "@/components/servicios/form/servicio-form-schema";
import type { Servicio } from "@/types";

import { getBillingCycleMonths } from "./servicio-form-helpers";

interface UseServicioFormBillingDatesParams {
  cicloPago: ServicioFormData["cicloPago"];
  fechaInicio: Date;
  getValues: UseFormGetValues<ServicioFormData>;
  isEditMode: boolean;
  servicio?: Servicio;
  setValue: UseFormSetValue<ServicioFormData>;
}

export function useServicioFormBillingDates({
  cicloPago,
  fechaInicio,
  getValues,
  isEditMode,
  servicio,
  setValue,
}: UseServicioFormBillingDatesParams) {
  const manualFechaVencimientoRef = useRef(false);
  const prevCicloPagoRef = useRef(servicio?.cicloPago ?? "mensual");
  const prevFechaInicioRef = useRef<Date | null>(
    servicio?.fechaInicio ? new Date(servicio.fechaInicio) : null,
  );
  const cicloInicializadoRef = useRef(false);
  const lastCicloIdRef = useRef<string | null>(null);
  const lastFechaInicioTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!servicio?.id) return;

    const servicioCiclo = servicio.cicloPago || "mensual";
    prevCicloPagoRef.current = servicioCiclo;
    lastCicloIdRef.current = servicioCiclo;
    lastFechaInicioTimeRef.current =
      servicio.fechaInicio ? new Date(servicio.fechaInicio).getTime() : null;
    cicloInicializadoRef.current = true;
    manualFechaVencimientoRef.current = true;
  }, [servicio?.id, servicio?.cicloPago, servicio?.fechaInicio]);

  useEffect(() => {
    if (!fechaInicio) return;

    if (isEditMode) {
      if (!cicloInicializadoRef.current) return;
      const cicloChanged =
        lastCicloIdRef.current !== null && lastCicloIdRef.current !== cicloPago;
      const fechaInicioChanged =
        lastFechaInicioTimeRef.current !== null &&
        lastFechaInicioTimeRef.current !== fechaInicio.getTime();
      if (cicloChanged || fechaInicioChanged) {
        setValue(
          "fechaVencimiento",
          addMonths(new Date(fechaInicio), getBillingCycleMonths(cicloPago)),
        );
      }
      if (cicloChanged) lastCicloIdRef.current = cicloPago;
      if (fechaInicioChanged) {
        lastFechaInicioTimeRef.current = fechaInicio.getTime();
      }
    } else {
      const cicloChanged = prevCicloPagoRef.current !== cicloPago;
      const fechaInicioChanged =
        prevFechaInicioRef.current?.getTime() !== fechaInicio.getTime();
      if (cicloChanged) {
        prevCicloPagoRef.current = cicloPago;
        manualFechaVencimientoRef.current = false;
      }
      if (fechaInicioChanged) {
        prevFechaInicioRef.current = fechaInicio;
        manualFechaVencimientoRef.current = false;
      }
      if (
        cicloChanged ||
        fechaInicioChanged ||
        !manualFechaVencimientoRef.current
      ) {
        setValue(
          "fechaVencimiento",
          addMonths(fechaInicio, getBillingCycleMonths(cicloPago)),
        );
      }
    }
  }, [
    cicloPago,
    fechaInicio,
    setValue,
    isEditMode,
  ]);

  const handleCicloPagoChange = (nextCiclo: ServicioFormData["cicloPago"]) => {
    setValue("cicloPago", nextCiclo);
    prevCicloPagoRef.current = nextCiclo;
    manualFechaVencimientoRef.current = false;
    const currentFechaInicio = getValues("fechaInicio");
    if (currentFechaInicio) {
      setValue(
        "fechaVencimiento",
        addMonths(currentFechaInicio, getBillingCycleMonths(nextCiclo)),
      );
    }
  };

  const handleFechaVencimientoSelect = (date: Date) => {
    setValue("fechaVencimiento", date);
    manualFechaVencimientoRef.current = true;
  };

  return {
    handleCicloPagoChange,
    handleFechaVencimientoSelect,
  };
}
