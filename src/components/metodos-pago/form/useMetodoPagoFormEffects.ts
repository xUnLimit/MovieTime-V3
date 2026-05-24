import { useEffect, useRef } from "react";
import type {
  FieldErrors,
  UseFormClearErrors,
  UseFormSetValue,
} from "react-hook-form";

import type { MetodoPago } from "@/types";
import { PAISES_MONEDAS } from "./options";
import type { MetodoPagoFormData } from "./schema";

interface MetodoPagoFormEffectsParams {
  asociadoAValue: MetodoPagoFormData["asociadoA"];
  clearErrors: UseFormClearErrors<MetodoPagoFormData>;
  contrasenaValue?: string;
  emailValue?: string;
  errors: FieldErrors<MetodoPagoFormData>;
  fechaExpiracionValue?: string;
  identificadorValue?: string;
  metodoPago?: MetodoPago;
  mode: "create" | "edit";
  monedaValue: string;
  nombreValue: string;
  numeroTarjetaValue?: string;
  paisValue: string;
  setValue: UseFormSetValue<MetodoPagoFormData>;
  tipoCuentaValue?: MetodoPagoFormData["tipoCuenta"];
  titularValue?: string;
}

export function useMetodoPagoFormEffects({
  asociadoAValue,
  clearErrors,
  contrasenaValue,
  emailValue,
  errors,
  fechaExpiracionValue,
  identificadorValue,
  metodoPago,
  mode,
  monedaValue,
  nombreValue,
  numeroTarjetaValue,
  paisValue,
  setValue,
  tipoCuentaValue,
  titularValue,
}: MetodoPagoFormEffectsParams) {
  const didSkipInitialPaisSyncRef = useRef(false);

  useEffect(() => {
    if (nombreValue && nombreValue.length >= 2 && errors.nombre) {
      clearErrors("nombre");
    }
  }, [nombreValue, errors.nombre, clearErrors]);

  useEffect(() => {
    if (asociadoAValue && errors.asociadoA) {
      clearErrors("asociadoA");
    }
  }, [asociadoAValue, errors.asociadoA, clearErrors]);

  useEffect(() => {
    if (paisValue && paisValue.length >= 2 && errors.pais) {
      clearErrors("pais");
    }
  }, [paisValue, errors.pais, clearErrors]);

  useEffect(() => {
    if (monedaValue && monedaValue.length >= 2 && errors.moneda) {
      clearErrors("moneda");
    }
  }, [monedaValue, errors.moneda, clearErrors]);

  useEffect(() => {
    if (titularValue && titularValue.length >= 2 && errors.titular) {
      clearErrors("titular");
    }
  }, [titularValue, errors.titular, clearErrors]);

  useEffect(() => {
    if (tipoCuentaValue && errors.tipoCuenta) {
      clearErrors("tipoCuenta");
    }
  }, [tipoCuentaValue, errors.tipoCuenta, clearErrors]);

  useEffect(() => {
    if (
      identificadorValue &&
      identificadorValue.length >= 2 &&
      errors.identificador
    ) {
      clearErrors("identificador");
    }
  }, [identificadorValue, errors.identificador, clearErrors]);

  useEffect(() => {
    if (emailValue && errors.email) {
      clearErrors("email");
    }
  }, [emailValue, errors.email, clearErrors]);

  useEffect(() => {
    if (contrasenaValue && contrasenaValue.length >= 6 && errors.contrasena) {
      clearErrors("contrasena");
    }
  }, [contrasenaValue, errors.contrasena, clearErrors]);

  useEffect(() => {
    if (
      numeroTarjetaValue &&
      numeroTarjetaValue.replace(/\s/g, "").length >= 16 &&
      errors.numeroTarjeta
    ) {
      clearErrors("numeroTarjeta");
    }
  }, [numeroTarjetaValue, errors.numeroTarjeta, clearErrors]);

  useEffect(() => {
    if (
      fechaExpiracionValue &&
      /^(0[1-9]|1[0-2])\/\d{2}$/.test(fechaExpiracionValue) &&
      errors.fechaExpiracion
    ) {
      clearErrors("fechaExpiracion");
    }
  }, [fechaExpiracionValue, errors.fechaExpiracion, clearErrors]);

  useEffect(() => {
    if (!paisValue) return;

    if (
      mode === "edit" &&
      metodoPago &&
      !didSkipInitialPaisSyncRef.current
    ) {
      didSkipInitialPaisSyncRef.current = true;
      return;
    }

    const paisMoneda = PAISES_MONEDAS.find((pm) => pm.pais === paisValue);
    if (paisMoneda) {
      setValue("moneda", paisMoneda.moneda);
    }
  }, [mode, metodoPago, paisValue, setValue]);
}
