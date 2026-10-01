import { Clock, Monitor, RefreshCw } from "lucide-react";

import type { Column } from "@/components/shared/DataTable";
import { getCurrencySymbol } from "@/platform/constants";
import { cn } from "@/platform/utils";
import { formatearFecha } from "@/platform/utils/calculations";
import type { ServicioRow } from "./servicios-list-table-types";

export function createServiciosListColumns(): Column<ServicioRow>[] {
  return [
    {
      key: "nombre",
      header: "Nombre",
      sortable: true,
      render: (item) => (
        <div className="flex min-w-0 items-center gap-2">
          <Monitor
            className={cn(
              "h-4 w-4 shrink-0",
              item.activo ? "text-success" : "text-danger",
            )}
          />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-medium" title={item.nombre}>{item.nombre}</p>
            <p className="truncate text-xs text-muted-foreground" title={item.correo}>{item.correo}</p>
          </div>
        </div>
      ),
    },
    {
      key: "categoriaNombre",
      hideBelow: "sm",
      header: "Categoría",
      sortable: true,
      render: (item) => (
        <span className="block truncate text-sm" title={item.categoriaNombre}>{item.categoriaNombre}</span>
      ),
    },
    {
      key: "cicloPago",
      hideBelow: "2xl",
      header: "Ciclo de Pago",
      sortable: true,
      align: "center",
      render: (item) => (
        <div className="flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{item.cicloPago}</span>
        </div>
      ),
    },
    {
      key: "fechaInicio",
      hideBelow: "2xl",
      header: "Fecha de Inicio",
      sortable: true,
      align: "center",
      render: (item) => (
        <div className="text-center">
          {item.fechaInicio ? formatearFecha(item.fechaInicio) : "—"}
        </div>
      ),
    },
    {
      key: "fechaVencimiento",
      hideBelow: "md",
      header: "Fecha de Vencimiento",
      sortable: true,
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
      align: "center",
      render: (item) => (
        <div className="whitespace-nowrap text-center font-medium">
          <span className="text-success">{getCurrencySymbol(item.moneda)}</span>
          <span className="text-foreground"> {item.costo.toFixed(2)}</span>
        </div>
      ),
    },
    {
      key: "renovaciones",
      hideBelow: "xl",
      header: "Renovaciones",
      sortable: true,
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
