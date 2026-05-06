import type { KeyboardEvent } from "react";
import { addMonths } from "date-fns";

import { CURRENCY_SYMBOLS } from "@/lib/constants";
import type { Servicio, TipoPlanConfig } from "@/types";

import type { ServicioEditFormData } from "./schema";

const CONTROL_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

export function getServicioEditDefaultValues(
  servicio: Servicio,
): ServicioEditFormData {
  return {
    nombre: servicio.nombre || "",
    categoriaId: servicio.categoriaId || "",
    tipoPlan: (servicio.tipo || "") as ServicioEditFormData["tipoPlan"],
    correo: servicio.correo || "",
    contrasena: servicio.contrasena || "",
    metodoPagoId: servicio.metodoPagoId || "",
    costoServicio: String(servicio.costoServicio || 0),
    perfilesDisponibles: String(servicio.perfilesDisponibles || 1),
    cicloPago: (servicio.cicloPago || "mensual") as ServicioEditFormData["cicloPago"],
    fechaInicio: servicio.fechaInicio ? new Date(servicio.fechaInicio) : new Date(),
    fechaVencimiento: servicio.fechaVencimiento
      ? new Date(servicio.fechaVencimiento)
      : addMonths(new Date(), 1),
    estado: servicio.activo ? "activo" : "inactivo",
    notas: servicio.notas || "",
  };
}

export function hasServicioEditFormChanges(
  servicio: Servicio,
  values: ServicioEditFormData,
) {
  return (
    values.nombre !== servicio.nombre ||
    values.correo !== servicio.correo ||
    values.contrasena !== servicio.contrasena ||
    values.categoriaId !== servicio.categoriaId ||
    values.tipoPlan !== servicio.tipo ||
    values.metodoPagoId !== (servicio.metodoPagoId || "") ||
    Number(values.costoServicio) !== Number(servicio.costoServicio ?? 0) ||
    String(values.perfilesDisponibles) !==
      String(servicio.perfilesDisponibles || 1) ||
    values.cicloPago !== (servicio.cicloPago || "mensual") ||
    values.estado !== (servicio.activo ? "activo" : "inactivo") ||
    values.notas !== (servicio.notas || "") ||
    values.fechaInicio?.getTime() !== servicio.fechaInicio?.getTime() ||
    values.fechaVencimiento?.getTime() !==
      servicio.fechaVencimiento?.getTime()
  );
}

export function getCicloLabel(ciclo: string) {
  switch (ciclo) {
    case "mensual":
      return "Mensual";
    case "trimestral":
      return "Trimestral";
    case "semestral":
      return "Semestral";
    case "anual":
      return "Anual";
    default:
      return "Seleccionar período";
  }
}

export function getEstadoLabel(estado: string) {
  switch (estado) {
    case "activo":
      return "Activo";
    case "inactivo":
      return "Inactivo";
    default:
      return "Seleccionar estado";
  }
}

export function getTipoPlanLabel(
  tipoId: string,
  tiposPlanes: TipoPlanConfig[],
) {
  if (!tipoId) return "Seleccionar tipo";
  const found = tiposPlanes.find((tipo) => tipo.id === tipoId);
  return found?.nombre ?? "Seleccionar tipo";
}

export function getSimboloMoneda(moneda?: string, pais?: string): string {
  if (!moneda) return "$";
  const monedaKey = moneda.toUpperCase();
  const paisKey = (pais || "").toUpperCase();
  return CURRENCY_SYMBOLS[monedaKey] || CURRENCY_SYMBOLS[paisKey] || monedaKey;
}

export function handleDecimalInputKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
) {
  const char = event.key;
  const currentValue = event.currentTarget.value;

  if (CONTROL_KEYS.has(char)) return;
  if (event.ctrlKey || event.metaKey) return;

  if (!/[0-9.]/.test(char)) {
    event.preventDefault();
  }

  if (char === "." && currentValue.includes(".")) {
    event.preventDefault();
  }
}

export function handleIntegerInputKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
) {
  const char = event.key;

  if (CONTROL_KEYS.has(char)) return;
  if (event.ctrlKey || event.metaKey) return;

  if (!/[0-9]/.test(char)) {
    event.preventDefault();
  }
}
