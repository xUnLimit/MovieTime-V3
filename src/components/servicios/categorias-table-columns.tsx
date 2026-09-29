import { Monitor, ShoppingCart, TrendingUp, Users } from "lucide-react";

import { defineDataTableColumns } from "@/components/shared/DataTable";
import { cn } from "@/platform/utils";

import type { CategoriaRow } from "./useCategoriasTableController";

function progressPercentage(activos: number, total: number) {
  return total === 0 ? 0 : Math.round((activos / total) * 100);
}

function IconCount({
  icon: Icon,
  value,
  iconClassName,
}: {
  icon: typeof Monitor;
  value: number;
  iconClassName: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Icon className={cn("size-4", value > 0 ? iconClassName : "text-muted-foreground")} />
      <span className={cn("font-medium", value === 0 && "text-muted-foreground")}>{value}</span>
    </div>
  );
}

function Amount({ value, className }: { value: number; className: string }) {
  const empty = value === 0;
  return (
    <div className="flex items-center justify-center gap-1 tabular-nums">
      <span className={empty ? "text-muted-foreground" : className}>$</span>
      <span className={cn(value < 0 && "text-danger", empty && "text-muted-foreground")}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

export function createCategoriasColumns(isLoadingVentas: boolean) {
  return defineDataTableColumns<CategoriaRow>([
    {
      key: "nombre",
      header: "Categoría",
      sortable: true,
      render: (row) => <span className="font-medium">{row.nombre}</span>,
    },
    {
      key: "totalServicios",
      header: "Total Servicios",
      sortable: true,
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-2">
          <Monitor
            className={cn("size-4", row.serviciosActivos > 0 ? "text-success" : "text-muted-foreground")}
          />
          <span className={cn("font-medium", row.serviciosActivos === 0 && "text-muted-foreground")}>
            {row.totalServicios}
          </span>
        </div>
      ),
    },
    {
      key: "serviciosActivos",
      header: "Servicios Activos",
      sortable: true,
      align: "center",
      hideBelow: "md",
      render: (row) => (
        <div className="mx-auto min-w-20 space-y-1">
          <div className="flex items-center justify-center gap-1">
            <TrendingUp
              className={cn("size-3", row.serviciosActivos > 0 ? "text-success" : "text-muted-foreground")}
            />
            <span className={cn("font-medium", row.serviciosActivos === 0 && "text-muted-foreground")}>
              {row.serviciosActivos} / {row.totalServicios}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${progressPercentage(row.serviciosActivos, row.totalServicios)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "perfilesDisponibles",
      header: "Perfiles Disponibles",
      sortable: true,
      align: "center",
      hideBelow: "sm",
      render: (row) => <IconCount icon={Users} value={row.perfilesDisponibles} iconClassName="text-success" />,
    },
    {
      key: "ventasTotales",
      header: "Suscripciones Activas",
      sortable: true,
      align: "center",
      hideBelow: "xl",
      render: (row) => <IconCount icon={ShoppingCart} value={row.ventasTotales} iconClassName="text-primary" />,
    },
    {
      key: "ingresoTotal",
      header: "Ingreso Total",
      sortable: true,
      align: "center",
      hideBelow: "lg",
      render: (row) => <Amount value={row.ingresoTotal} className="text-info" />,
    },
    {
      key: "gastosTotal",
      header: "Gastos Totales",
      sortable: true,
      align: "center",
      hideBelow: "2xl",
      render: (row) => <Amount value={row.gastosTotal} className="text-danger" />,
    },
    {
      key: "gananciaTotal",
      header: "Ganancia Total",
      sortable: true,
      align: "center",
      hideBelow: "lg",
      render: (row) => <Amount value={row.gananciaTotal} className="text-success" />,
    },
    {
      key: "montoSinConsumir",
      header: "Monto Sin Consumir",
      sortable: true,
      align: "center",
      hideBelow: "2xl",
      render: (row) =>
        isLoadingVentas ? (
          <div className="mx-auto h-4 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <Amount value={row.montoSinConsumir} className="text-warning" />
        ),
    },
  ]);
}
