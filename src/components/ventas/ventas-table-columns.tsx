import { Clock, Monitor, RefreshCw, User } from "lucide-react";

import type { Column } from "@/components/shared/DataTable";
import { getCurrencySymbol } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  calcularMontoSinConsumir,
  formatearFecha,
} from "@/lib/utils/calculations";
import type { VentaDoc } from "@/types";

export interface VentaRow extends Record<string, unknown> {
  id: string;
  cliente: string;
  clienteDetalle: string;
  servicio: string;
  servicioDetalle: string;
  cicloPago: string;
  fechaInicio?: Date;
  fechaVencimiento?: Date;
  monto: number;
  consumoPorcentaje: number;
  montoSinConsumir: number;
  moneda: string;
  estado: "activa" | "inactiva";
  renovaciones: number;
  categoriaId?: string;
  original: VentaDoc;
}

const getCicloPagoLabel = (ciclo?: string) => {
  const labels: Record<string, string> = {
    mensual: "Mensual",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };
  return ciclo ? labels[ciclo] || ciclo : "-";
};

export function toVentaRow(venta: VentaDoc): VentaRow {
  const moneda = venta.moneda || "USD";
  const monto = venta.precioFinal ?? 0;
  const montoSinConsumir =
    venta.fechaInicio && venta.fechaFin
      ? calcularMontoSinConsumir(
          new Date(venta.fechaInicio),
          new Date(venta.fechaFin),
          monto,
        )
      : 0;
  const consumoPorcentaje =
    monto > 0 ? Math.round(((monto - montoSinConsumir) / monto) * 100) : 0;
  const estado: VentaRow["estado"] =
    venta.estado === "inactivo" ? "inactiva" : "activa";

  return {
    id: venta.id,
    cliente: venta.clienteNombre || "Sin cliente",
    clienteDetalle: "",
    servicio: venta.servicioNombre,
    servicioDetalle: venta.servicioCorreo || "Sin correo",
    cicloPago: getCicloPagoLabel(venta.cicloPago),
    fechaInicio: venta.fechaInicio ? new Date(venta.fechaInicio) : undefined,
    fechaVencimiento: venta.fechaFin ? new Date(venta.fechaFin) : undefined,
    monto,
    consumoPorcentaje,
    montoSinConsumir,
    moneda,
    estado,
    renovaciones: (venta as VentaDoc & { renovaciones?: number })
      .renovaciones ?? 0,
    categoriaId: venta.categoriaId,
    original: venta,
  };
}

export const ventasTableColumns: Column<VentaRow>[] = [
  {
    key: "cliente",
    header: "Cliente",
    sortable: true,
    width: "16%",
    render: (item) => (
      <div className="flex items-center gap-2">
        <User
          className={cn(
            "h-4 w-4",
            item.estado === "inactiva" ? "text-red-500" : "text-green-500",
          )}
        />
        <div>
          <p className="font-medium">{item.cliente}</p>
          {item.clienteDetalle ? (
            <p className="text-xs text-muted-foreground">
              {item.clienteDetalle}
            </p>
          ) : null}
        </div>
      </div>
    ),
  },
  {
    key: "servicio",
    header: "Servicio",
    sortable: true,
    width: "18%",
    render: (item) => (
      <div className="flex items-center gap-2">
        <Monitor
          className={cn(
            "h-4 w-4",
            item.estado === "inactiva" ? "text-red-500" : "text-green-500",
          )}
        />
        <div>
          <p className="font-medium">{item.servicio}</p>
          <p className="text-xs text-muted-foreground">
            {item.servicioDetalle}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "cicloPago",
    header: "Ciclo de Pago",
    sortable: true,
    width: "12%",
    align: "center",
    render: (item) => (
      <div className="flex items-center justify-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{getCicloPagoLabel(item.cicloPago)}</span>
      </div>
    ),
  },
  {
    key: "fechaInicio",
    header: "Fecha de Inicio",
    sortable: true,
    width: "12%",
    align: "center",
    render: (item) => (
      <div className="text-center">
        {item.fechaInicio ? formatearFecha(item.fechaInicio) : "-"}
      </div>
    ),
  },
  {
    key: "fechaVencimiento",
    header: "Fecha de Vencimiento",
    sortable: true,
    width: "12%",
    align: "center",
    render: (item) => (
      <div className="text-center">
        {item.fechaVencimiento ? formatearFecha(item.fechaVencimiento) : "-"}
      </div>
    ),
  },
  {
    key: "monto",
    header: "Monto",
    sortable: true,
    width: "10%",
    align: "center",
    render: (item) => (
      <div className="text-center font-medium">
        <span className="text-green-500">{getCurrencySymbol(item.moneda)}</span>
        <span className="text-foreground"> {item.monto.toFixed(2)}</span>
      </div>
    ),
  },
  {
    key: "consumoPorcentaje",
    header: "Consumo del Pago",
    sortable: true,
    width: "14%",
    align: "center",
    render: (item) => (
      <div className="min-w-[140px] text-center">
        <span className="text-xs text-muted-foreground">
          {item.consumoPorcentaje}%
        </span>
        <div className="mt-1 h-2 w-full rounded-full bg-muted">
          <div
            className={cn(
              "h-2 rounded-full",
              item.consumoPorcentaje >= 75
                ? "bg-red-500"
                : item.consumoPorcentaje >= 45
                  ? "bg-yellow-500"
                  : "bg-green-500",
            )}
            style={{ width: `${item.consumoPorcentaje}%` }}
          />
        </div>
      </div>
    ),
  },
  {
    key: "montoSinConsumir",
    header: "Monto Sin Consumir",
    sortable: true,
    width: "12%",
    align: "center",
    render: (item) => (
      <div className="text-center font-medium">
        <span className="text-green-500">{getCurrencySymbol(item.moneda)}</span>
        <span className="text-foreground">
          {" "}
          {item.montoSinConsumir.toFixed(2)}
        </span>
      </div>
    ),
  },
  {
    key: "renovaciones",
    header: "Renovaciones",
    sortable: true,
    width: "9%",
    align: "center",
    render: (item) => (
      <div className="flex items-center justify-center gap-1.5 font-medium">
        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-foreground">{item.renovaciones}</span>
      </div>
    ),
  },
];
