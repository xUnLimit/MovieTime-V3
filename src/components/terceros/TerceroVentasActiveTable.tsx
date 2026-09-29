"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Clock,
  Copy,
  Monitor,
  MoreHorizontal,
  RefreshCw,
  ShoppingCart,
  XCircle,
} from "lucide-react";

import { DataTable, defineDataTableColumns } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrencySymbol } from "@/platform/constants";
import { formatearFecha } from "@/platform/utils/calculations";

import type { TerceroDetailsRow } from "./useTerceroDetailsController";

interface TerceroVentasActiveTableProps {
  rows: TerceroDetailsRow[];
  onCopy: (value: string, label?: string) => void;
  onOpenEstadoDialog: (modo: "activar" | "inactivar", row: TerceroDetailsRow) => void;
}

function DiasRestantesBadge({ diasRestantes }: { diasRestantes: number }) {
  if (diasRestantes < 0) {
    const diasRetraso = Math.abs(diasRestantes);
    return (
      <StatusBadge tone="danger" dot={false}>
        <AlertTriangle className="size-3 shrink-0" />
        {diasRetraso} día{diasRetraso !== 1 ? "s" : ""} de retraso
      </StatusBadge>
    );
  }

  if (diasRestantes === 0) return <StatusBadge tone="danger">Vence hoy</StatusBadge>;

  if (diasRestantes <= 7) {
    return (
      <StatusBadge tone="warning">
        {diasRestantes} día{diasRestantes !== 1 ? "s" : ""} restante{diasRestantes !== 1 ? "s" : ""}
      </StatusBadge>
    );
  }

  return <StatusBadge tone="success">{diasRestantes} días restantes</StatusBadge>;
}

function IconValue({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <span className="font-medium">{children}</span>
    </div>
  );
}

function CopyValue({ value, label, onCopy }: { value: string; label: string; onCopy: TerceroVentasActiveTableProps["onCopy"] }) {
  return (
    <div className="inline-flex items-center gap-1">
      <span className="font-medium">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Copiar ${label.toLowerCase()}`}
        onClick={() => onCopy(value, label)}
      >
        <Copy />
      </Button>
    </div>
  );
}

export function TerceroVentasActiveTable({
  rows,
  onCopy,
  onOpenEstadoDialog,
}: TerceroVentasActiveTableProps) {
  const columns = useMemo(
    () =>
      defineDataTableColumns<TerceroDetailsRow>([
        {
          key: "categoriaNombre",
          header: "Categoría",
          render: (row) => (
            <div className="flex items-center gap-2">
              <Monitor className="size-4 shrink-0 text-success" />
              <div>
                <p className="font-medium">{row.categoriaNombre}</p>
                <p className="text-xs text-muted-foreground">{row.servicioNombre}</p>
              </div>
            </div>
          ),
        },
        {
          key: "correo",
          header: "Email",
          hideBelow: "lg",
          render: (row) => <CopyValue value={row.correo} label="Correo" onCopy={onCopy} />,
        },
        {
          key: "contrasena",
          header: "Contraseña",
          align: "center",
          hideBelow: "xl",
          render: (row) => <CopyValue value={row.contrasena} label="Contraseña" onCopy={onCopy} />,
        },
        {
          key: "cicloPago",
          header: "Ciclo de Pago",
          align: "center",
          hideBelow: "2xl",
          render: (row) => <IconValue icon={Clock}>{row.cicloPago}</IconValue>,
        },
        {
          key: "fechaInicio",
          header: "Fecha de Inicio",
          align: "center",
          hideBelow: "2xl",
          render: (row) => <IconValue icon={Calendar}>{row.fechaInicio ? formatearFecha(row.fechaInicio) : "—"}</IconValue>,
        },
        {
          key: "fechaFin",
          header: "Fecha de Expiración",
          align: "center",
          hideBelow: "lg",
          render: (row) => <IconValue icon={Calendar}>{row.fechaFin ? formatearFecha(row.fechaFin) : "—"}</IconValue>,
        },
        {
          key: "montoSinConsumir",
          header: "Monto Sin Consumir",
          align: "center",
          hideBelow: "md",
          render: (row) => (
            <span className="font-medium tabular-nums">
              <span className="text-success">{getCurrencySymbol(row.moneda)}</span> {row.montoSinConsumir.toFixed(2)}
            </span>
          ),
        },
        {
          key: "renovaciones",
          header: "Renovaciones",
          align: "center",
          hideBelow: "2xl",
          render: (row) => (
            <span className="inline-flex items-center justify-center gap-1 font-medium">
              <RefreshCw className="size-3.5 text-muted-foreground" />
              {row.renovaciones}
            </span>
          ),
        },
        {
          key: "diasRestantes",
          header: "Días Restantes",
          align: "center",
          render: (row) => <DiasRestantesBadge diasRestantes={row.diasRestantes} />,
        },
      ]),
    [onCopy],
  );

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
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onOpenEstadoDialog("inactivar", row)}>
              <XCircle />
              Inactivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    />
  );
}
