import type { CrecimientoPeriod } from "./crecimiento-terceros-helpers";

export const PERIOD_OPTIONS: Array<{
  value: CrecimientoPeriod;
  label: string;
}> = [
  { value: "actual", label: "Mes actual" },
  { value: "3meses", label: "Ultimos 3 meses" },
  { value: "6meses", label: "Ultimos 6 meses" },
  { value: "12meses", label: "Ultimos 12 meses" },
];

export const CRECIMIENTO_VISTAS = [
  { id: "crecimiento", title: "Terceros Nuevos" },
  { id: "bajas", title: "Clientes Perdidos" },
  { id: "balance", title: "Crecimiento Neto" },
] as const;

export type CrecimientoVista = (typeof CRECIMIENTO_VISTAS)[number];
