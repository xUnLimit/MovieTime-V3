"use client";

import Link from "next/link";
import { Calendar, Clock, Monitor, MoreHorizontal, RefreshCw, ShoppingCart } from "lucide-react";

import { DataTable, defineDataTableColumns } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatearFecha } from "@/platform/utils/calculations";

import type { TerceroDetailsRow } from "./useTerceroDetailsController";

interface TerceroVentasHistorialTableProps {
  rows: TerceroDetailsRow[];
}

function IconValue({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <span className="font-medium">{children}</span>
    </div>
  );
}

const columns = defineDataTableColumns<TerceroDetailsRow>([
  {
    key: "categoriaNombre",
    header: "Categoría",
    render: (row) => (
      <div className="flex items-center gap-2">
        <Monitor className="size-4 shrink-0 text-danger" />
        <div>
          <p className="font-medium">{row.categoriaNombre}</p>
          <p className="text-xs text-muted-foreground">{row.servicioNombre}</p>
        </div>
      </div>
    ),
  },
  {
    key: "cicloPago",
    header: "Ciclo de Pago",
    align: "center",
    hideBelow: "xl",
    render: (row) => <IconValue icon={Clock}>{row.cicloPago}</IconValue>,
  },
  {
    key: "fechaInicio",
    header: "Fecha de Inicio",
    align: "center",
    hideBelow: "lg",
    render: (row) => <IconValue icon={Calendar}>{row.fechaInicio ? formatearFecha(row.fechaInicio) : "—"}</IconValue>,
  },
  {
    key: "fechaFin",
    header: "Fecha de Expiración",
    align: "center",
    hideBelow: "md",
    render: (row) => <IconValue icon={Calendar}>{row.fechaFin ? formatearFecha(row.fechaFin) : "—"}</IconValue>,
  },
  {
    key: "renovaciones",
    header: "Renovaciones",
    align: "center",
    hideBelow: "xl",
    render: (row) => (
      <span className="inline-flex items-center justify-center gap-1 font-medium">
        <RefreshCw className="size-3.5 text-muted-foreground" />
        {row.renovaciones}
      </span>
    ),
  },
  {
    key: "cortadaAt",
    header: "Estado",
    align: "center",
    render: (row) => (
      <StatusBadge tone={row.cortadaAt ? "warning" : "danger"}>{row.cortadaAt ? "Cortada" : "Inactiva"}</StatusBadge>
    ),
  },
]);

export function TerceroVentasHistorialTable({ rows }: TerceroVentasHistorialTableProps) {
  return (
    <DataTable
      bare
      data={rows}
      columns={columns}
      actions={(row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Acciones de la venta">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link prefetch={false} href={`/ventas/${row.id}`}>
                <ShoppingCart />
                Ver Venta
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link prefetch={false} href={`/servicios/detalle/${row.servicioId}`}>
                <Monitor />
                Ver Servicio
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    />
  );
}
