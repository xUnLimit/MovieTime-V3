import { addDays } from "date-fns";

import { CURRENCY_SYMBOLS, CYCLE_MONTHS } from "@/lib/constants";
import type { ServicioFormData } from "@/features/servicios/servicio-form-schema";
import type { Categoria, MetodoPago, Servicio, TipoPlanConfig } from "@/types";

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

type NumericKeyEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  currentTarget: {
    value: string;
  };
  preventDefault: () => void;
};

export function getBillingCycleMonths(
  ciclo: ServicioFormData["cicloPago"],
): number {
  return CYCLE_MONTHS[ciclo] ?? 1;
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
    case "reposo":
      return "Reposo";
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

export function getPerfilCapacityError({
  estado,
  perfilesDisponibles,
  perfilesOcupados,
}: {
  estado: ServicioFormData["estado"];
  perfilesDisponibles: number;
  perfilesOcupados: number;
}): string | null {
  if (estado !== "activo" || perfilesDisponibles >= perfilesOcupados) {
    return null;
  }

  return `No se puede reducir por debajo de los ${perfilesOcupados} perfil${
    perfilesOcupados !== 1 ? "es" : ""
  } actualmente ocupado${perfilesOcupados !== 1 ? "s" : ""}`;
}

export function buildServicioFormPayload({
  categoria,
  data,
  metodoPago,
  servicio,
  tipoPlan,
}: {
  categoria?: Categoria;
  data: ServicioFormData;
  metodoPago?: Pick<MetodoPago, "moneda" | "nombre">;
  servicio?: Servicio;
  tipoPlan: TipoPlanConfig;
}) {
  return {
    nombre: data.nombre,
    categoriaId: data.categoriaId,
    categoriaNombre: categoria?.nombre || "",
    correo: data.correo,
    contrasena: data.contrasena,
    tipo: data.tipoPlan,
    tipoNombre: tipoPlan.nombre,
    costoServicio: Number(data.costoServicio),
    perfilesDisponibles: Number(data.perfilesDisponibles),
    metodoPagoId: data.metodoPagoId,
    metodoPagoNombre: metodoPago?.nombre,
    moneda: metodoPago?.moneda,
    cicloPago: data.cicloPago,
    fechaInicio: data.fechaInicio,
    fechaVencimiento: data.fechaVencimiento,
    notas: data.notas,
    activo: data.estado === "activo",
    enReposo: data.estado === "reposo",
    diasReposo:
      data.estado === "reposo" ? Number(data.diasReposo || 28) : undefined,
    fechaInicioReposo:
      data.estado === "reposo" ? data.fechaInicio : undefined,
    fechaFinReposo:
      data.estado === "reposo"
        ? addDays(data.fechaInicio, Number(data.diasReposo || 28))
        : undefined,
    renovacionAutomatica: data.renovacionAutomatica,
    createdBy: "admin",
    gastosTotal: servicio?.gastosTotal ?? 0,
  };
}

export function handleDecimalInputKeyDown(event: NumericKeyEvent) {
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

export function handleIntegerInputKeyDown(event: NumericKeyEvent) {
  const char = event.key;

  if (CONTROL_KEYS.has(char)) return;
  if (event.ctrlKey || event.metaKey) return;

  if (!/[0-9]/.test(char)) {
    event.preventDefault();
  }
}
