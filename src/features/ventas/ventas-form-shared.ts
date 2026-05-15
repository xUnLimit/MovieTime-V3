import type { Servicio } from "@/types";

export type TipoVentaItem = "cuenta" | "perfil";

export interface VentaItem {
  id: string;
  itemId: string;
  tipo: TipoVentaItem;
  planId: string;
  planNombre: string;
  planTipoNombre?: string;
  categoriaId: string;
  categoriaNombre: string;
  servicioId: string;
  servicioNombre: string;
  servicioCorreo?: string;
  servicioContrasena?: string;
  cicloPago?: "mensual" | "trimestral" | "semestral" | "anual";
  fechaInicio?: Date;
  fechaFin?: Date;
  perfilNumero?: number;
  perfilNombre?: string;
  precio: number;
  descuento: number;
  precioFinal: number;
  codigo?: string;
  notas?: string;
}

export interface VentaItemErrors {
  categoria?: string;
  servicio?: string;
  plan?: string;
  perfil?: string;
  precio?: string;
}

export interface MetodoPagoTerceroOption {
  id: string;
  nombre: string;
  asociadoA: string;
  moneda: string;
}

export interface PerfilDetalleOcupado {
  perfilNumero: number;
  clienteNombre?: string;
  perfilNombre?: string;
  createdAt?: Date;
  fechaFin?: Date;
  cicloPago?: string;
}

export interface PerfilDetalleVisual {
  numero: number;
  estado: "disponible" | "ocupado" | "pendiente";
  perfilNombre: string;
  clienteNombre?: string;
  fechaFin?: Date;
  cicloPago?: string;
}

export interface PerfilesDetalleResumen {
  ocupados: number;
  disponibles: number;
  pendientes: number;
  total: number;
}

export type ServicioPerfilDetalle = Pick<
  Servicio,
  "nombre" | "correo"
> | null;

export const MESES_POR_CICLO: Record<string, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export const SERVICIOS_DROPDOWN_VISIBLE_ROWS = 10;

export function getCicloPagoLabel(ciclo?: string) {
  const labels: Record<string, string> = {
    mensual: "Mensual",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };
  return ciclo ? labels[ciclo] || ciclo : "—";
}
