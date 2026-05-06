import type { DefaultValues } from "react-hook-form";
import type { MetodoPago } from "@/types";
import type { MetodoPagoFormData } from "./schema";

export type MetodoPagoFormMode = "create" | "edit";

export function getMetodoPagoDefaultValues(
  mode: MetodoPagoFormMode,
  metodoPago?: MetodoPago,
): DefaultValues<MetodoPagoFormData> {
  if (mode === "edit" && metodoPago) {
    return {
      nombre: metodoPago.nombre,
      asociadoA: metodoPago.asociadoA,
      pais: metodoPago.pais,
      moneda: metodoPago.moneda || "USD",
      alias: metodoPago.alias || "",
      titular: metodoPago.titular,
      tipoCuenta:
        metodoPago.tipoCuenta &&
        ["ahorro", "corriente", "wallet", "telefono", "email"].includes(
          metodoPago.tipoCuenta,
        )
          ? (metodoPago.tipoCuenta as
              | "ahorro"
              | "corriente"
              | "wallet"
              | "telefono"
              | "email"
              | undefined)
          : undefined,
      identificador: metodoPago.identificador,
      email: metodoPago.email || "",
      contrasena: metodoPago.contrasena || "",
      numeroTarjeta: metodoPago.numeroTarjeta || "",
      fechaExpiracion: metodoPago.fechaExpiracion || "",
      notas: metodoPago.notas || "",
    };
  }

  return {
    nombre: "",
    asociadoA: undefined as "servicio" | "usuario" | undefined,
    pais: "",
    moneda: "",
    alias: "",
    titular: "",
    tipoCuenta: undefined as
      | "ahorro"
      | "corriente"
      | "wallet"
      | "telefono"
      | "email"
      | undefined,
    identificador: "",
    email: "",
    contrasena: "",
    numeroTarjeta: "",
    fechaExpiracion: "",
    notas: "",
  };
}

export function hasMetodoPagoFormChanges(
  mode: MetodoPagoFormMode,
  metodoPago: MetodoPago | undefined,
  values: MetodoPagoFormData,
) {
  if (mode !== "edit" || !metodoPago) return true;
  if (values.nombre !== metodoPago.nombre) return true;
  if (values.pais !== metodoPago.pais) return true;
  if (values.moneda !== (metodoPago.moneda || "USD")) return true;
  if (values.titular !== metodoPago.titular) return true;
  if (values.asociadoA !== metodoPago.asociadoA) return true;
  if ((values.alias || "") !== (metodoPago.alias || "")) return true;
  if ((values.notas || "") !== (metodoPago.notas || "")) return true;
  if (values.asociadoA === "usuario") {
    if (values.tipoCuenta !== metodoPago.tipoCuenta) return true;
    if (values.identificador !== metodoPago.identificador) return true;
  } else if (values.asociadoA === "servicio") {
    if (values.email !== (metodoPago.email || "")) return true;
    if (values.contrasena !== (metodoPago.contrasena || "")) return true;
    if (values.numeroTarjeta !== (metodoPago.numeroTarjeta || "")) return true;
    if (values.fechaExpiracion !== (metodoPago.fechaExpiracion || ""))
      return true;
  }
  return false;
}

export function capitalizeFirstChar(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatCardNumber(value: string) {
  let digits = value.replace(/\D/g, "");

  if (digits.length > 19) {
    digits = digits.slice(0, 19);
  }

  return digits.match(/.{1,4}/g)?.join(" ") || digits;
}

export function isAllowedCardNumberKey(key: string) {
  const allowedKeys = [
    "Backspace",
    "Delete",
    "Tab",
    "Escape",
    "Enter",
    "ArrowLeft",
    "ArrowRight",
  ];
  const allowedChars = /[0-9]/;

  return allowedKeys.includes(key) || allowedChars.test(key);
}

export function formatExpirationDate(input: string, previousValue: string) {
  const digits = input.replace(/\D/g, "");
  const isDeleting = input.length < previousValue.length;

  if (digits.length === 0) {
    return "";
  }

  const limitedDigits = digits.slice(0, 4);

  if (isDeleting && limitedDigits.length <= 2) {
    return limitedDigits;
  }

  if (limitedDigits.length > 2) {
    return limitedDigits.slice(0, 2) + "/" + limitedDigits.slice(2);
  }

  if (limitedDigits.length === 2 && !isDeleting) {
    return limitedDigits + "/";
  }

  return limitedDigits;
}
