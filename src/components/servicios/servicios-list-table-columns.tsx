import { Clock, Monitor, RefreshCw } from "lucide-react";

import type { Column } from "@/components/shared/DataTable";
import { getCurrencySymbol } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatearFecha } from "@/lib/utils/calculations";
import type { ServicioRow } from "./servicios-list-table-types";

export function createServiciosListColumns(): Column<ServicioRow>[] {
  return [
    {
      key: "nombre",
      header: "Nombre",
      sortable: true,
      width: "20%",
      render: (item) => (
        <div className="flex items-center gap-2">
          <Monitor
            className={cn(
              "h-4 w-4 shrink-0",
              item.activo ? "text-green-500" : "text-red-500",
            )}
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{item.nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{item.correo}</p>
          </div>
        </div>
      ),
    },
    {
      key: "categoriaNombre",
      header: "Categoría",
      sortable: true,
      width: "10%",
      render: (item) => (
        <span className="text-sm">{item.categoriaNombre}</span>
      ),
    },
    {
      key: "cicloPago",
      header: "Ciclo de Pago",
      sortable: true,
      width: "10%",
      align: "center",
      render: (item) => (
        <div className="flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{item.cicloPago}</span>
        </div>
      ),
    },
    {
      key: "fechaInicio",
      header: "Fecha de Inicio",
      sortable: true,
      width: "14%",
      align: "center",
      render: (item) => (
        <div className="text-center">
          {item.fechaInicio ? formatearFecha(item.fechaInicio) : "—"}
        </div>
      ),
    },
    {
      key: "fechaVencimiento",
      header: "Fecha de Vencimiento",
      sortable: true,
      width: "14%",
      align: "center",
      render: (item) => (
        <div className="text-center">
          {item.fechaVencimiento ? formatearFecha(item.fechaVencimiento) : "—"}
        </div>
      ),
    },
    {
      key: "costo",
      header: "Monto",
      sortable: true,
      width: "10%",
      align: "center",
      render: (item) => (
        <div className="text-center font-medium">
          <span className="text-green-500">{getCurrencySymbol(item.moneda)}</span>
          <span className="text-foreground"> {item.costo.toFixed(2)}</span>
        </div>
      ),
    },
    {
      key: "renovaciones",
      header: "Renovaciones",
      sortable: true,
      width: "12%",
      align: "center",
      render: (item) => (
        <div className="flex items-center justify-center gap-1.5 font-medium">
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-foreground">{item.renovaciones}</span>
        </div>
      ),
    },
  ];
}
