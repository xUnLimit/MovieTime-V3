import { CURRENCY_SYMBOLS, CYCLE_MONTHS } from "@/lib/constants";
import type { ServicioFormData } from "@/features/servicios/servicio-form-schema";
import type { TipoPlanConfig } from "@/types";

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
