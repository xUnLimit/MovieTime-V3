import { useEffect, useRef, useState } from "react";
import { addMonths } from "date-fns";
import type {
  FieldErrors,
  UseFormClearErrors,
  UseFormSetValue,
} from "react-hook-form";

import { CYCLE_MONTHS } from "@/lib/constants";
import { countVentasActivasByServicioUseCase } from "@/lib/use-cases/ventas-use-cases";
import type { Servicio } from "@/types";

import type { ServicioEditFormData } from "./schema";

interface AutoFechaParams {
  cicloPagoValue: ServicioEditFormData["cicloPago"];
  fechaInicioValue: Date;
  setValue: UseFormSetValue<ServicioEditFormData>;
}

interface AutoClearErrorsParams {
  clearErrors: UseFormClearErrors<ServicioEditFormData>;
  errors: FieldErrors<ServicioEditFormData>;
  values: ServicioEditFormData;
}

export function usePerfilesOcupadosReal(servicio: Servicio) {
  const [perfilesOcupadosReal, setPerfilesOcupadosReal] = useState<number>(
    servicio.perfilesOcupados || 0,
  );

  useEffect(() => {
    countVentasActivasByServicioUseCase(servicio.id).then((count) =>
      setPerfilesOcupadosReal(count),
    );
  }, [servicio.id]);

  return perfilesOcupadosReal;
}

export function useAutoFechaVencimiento({
  cicloPagoValue,
  fechaInicioValue,
  setValue,
}: AutoFechaParams) {
  const cicloInicializadoRef = useRef(false);
  const lastCicloIdRef = useRef<string | null>(null);
  const lastFechaInicioTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cicloInicializadoRef.current) {
      if (cicloPagoValue) {
        lastCicloIdRef.current = cicloPagoValue;
        lastFechaInicioTimeRef.current = fechaInicioValue?.getTime() ?? null;
        cicloInicializadoRef.current = true;
      }
      return;
    }

    if (!fechaInicioValue) return;

    const cicloChanged =
      lastCicloIdRef.current !== null &&
      lastCicloIdRef.current !== cicloPagoValue;
    const fechaInicioChanged =
      lastFechaInicioTimeRef.current !== null &&
      lastFechaInicioTimeRef.current !== fechaInicioValue.getTime();

    if (cicloChanged || fechaInicioChanged) {
      const meses =
        CYCLE_MONTHS[cicloPagoValue as keyof typeof CYCLE_MONTHS] ?? 1;
      const fechaCalculada = addMonths(new Date(fechaInicioValue), meses);
      setValue("fechaVencimiento", fechaCalculada);
    }

    if (cicloChanged) {
      lastCicloIdRef.current = cicloPagoValue;
    }
    if (fechaInicioChanged) {
      lastFechaInicioTimeRef.current = fechaInicioValue.getTime();
    }
  }, [cicloPagoValue, fechaInicioValue, setValue]);
}

export function useAutoClearServicioEditErrors({
  clearErrors,
  errors,
  values,
}: AutoClearErrorsParams) {
  useEffect(() => {
    if (values.nombre && values.nombre.length >= 2 && errors.nombre) {
      clearErrors("nombre");
    }
  }, [values.nombre, errors.nombre, clearErrors]);

  useEffect(() => {
    if (
      values.correo &&
      values.correo.includes("@") &&
      values.correo.includes(".") &&
      errors.correo
    ) {
      clearErrors("correo");
    }
  }, [values.correo, errors.correo, clearErrors]);

  useEffect(() => {
    if (
      values.contrasena &&
      values.contrasena.length >= 6 &&
      errors.contrasena
    ) {
      clearErrors("contrasena");
    }
  }, [values.contrasena, errors.contrasena, clearErrors]);

  useEffect(() => {
    if (values.categoriaId && errors.categoriaId) {
      clearErrors("categoriaId");
    }
  }, [values.categoriaId, errors.categoriaId, clearErrors]);

  useEffect(() => {
    if (values.tipoPlan && errors.tipoPlan) {
      clearErrors("tipoPlan");
    }
  }, [values.tipoPlan, errors.tipoPlan, clearErrors]);

  useEffect(() => {
    if (values.metodoPagoId && errors.metodoPagoId) {
      clearErrors("metodoPagoId");
    }
  }, [values.metodoPagoId, errors.metodoPagoId, clearErrors]);

  useEffect(() => {
    if (
      values.costoServicio &&
      !isNaN(Number(values.costoServicio)) &&
      Number(values.costoServicio) > 0 &&
      errors.costoServicio
    ) {
      clearErrors("costoServicio");
    }
  }, [values.costoServicio, errors.costoServicio, clearErrors]);

  useEffect(() => {
    const perfiles = Number(values.perfilesDisponibles);
    const esValido =
      values.perfilesDisponibles &&
      !isNaN(perfiles) &&
      perfiles >= 1 &&
      Number.isInteger(perfiles);

    if (esValido && errors.perfilesDisponibles) {
      clearErrors("perfilesDisponibles");
    }
  }, [
    values.perfilesDisponibles,
    errors.perfilesDisponibles,
    clearErrors,
  ]);
}
