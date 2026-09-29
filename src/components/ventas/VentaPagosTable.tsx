"use client";

import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit, MoreHorizontal, Trash2 } from "lucide-react";
import { DataTable, defineDataTableColumns } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrencySymbol } from "@/platform/constants";
import { formatAggregateInUSD, sumInUSD } from "@/modules/payments";
import { cn } from "@/platform/utils";
import { formatearFecha } from "@/platform/utils/calculations";
import { queryKeys } from "@/platform/query-keys";
import { reportError } from "@/platform/observability/logger";
import { VentaPago } from "@/types";

interface VentaPagosTableProps {
  pagos: VentaPago[];
  moneda: string;
  canManagePagos: boolean;
  onEdit: (pago: VentaPago) => void;
  onDelete: (pago: VentaPago) => void;
}

const EMPTY_VALUE = "-";

const getCicloPagoLabel = (ciclo?: string | null) => {
  const labels: Record<string, string> = {
    mensual: "Mensual",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };
  return ciclo ? labels[ciclo] || ciclo : EMPTY_VALUE;
};

export const VentaPagosTable = memo(function VentaPagosTable({
  pagos,
  moneda,
  canManagePagos,
  onEdit,
  onDelete,
}: VentaPagosTableProps) {
  const totalSignature = useMemo(
    () =>
      pagos
        .map((pago) =>
          [
            pago.id,
            pago.estado,
            pago.total ?? 0,
            pago.moneda || moneda || "USD",
          ].join(":"),
        )
        .join("|"),
    [pagos, moneda],
  );

  const { data: totalIngresosUSD = 0, isFetching: isCalculatingTotal } =
    useQuery({
      queryKey: queryKeys.ventas.pagosTotalUsd(totalSignature),
      queryFn: async () => {
        try {
          return await sumInUSD(
            pagos.map((p) => ({
              monto:
                p.estado === "reembolsado"
                  ? -(p.total ?? 0)
                  : p.estado === "anulado"
                    ? 0
                    : p.total ?? 0,
              moneda: p.moneda || moneda || "USD",
            })),
          );
        } catch (error) {
          reportError("VentaPagosTable", "Error calculating total", error);
          return 0;
        }
      },
    });

  const columns = useMemo(
    () =>
      defineDataTableColumns<VentaPago>([
        {
          key: "fecha",
          header: "Fecha de pago",
          render: (pago) => (
            <span className="whitespace-nowrap">
              {pago.fecha ? formatearFecha(new Date(pago.fecha)) : EMPTY_VALUE}
            </span>
          ),
        },
        {
          key: "descripcion",
          header: "Descripcion",
          render: (pago) => (
            <span className={cn("font-medium", pago.estado === "reembolsado" && "text-danger")}>
              {pago.descripcion}
            </span>
          ),
        },
        {
          key: "metodoPagoNombre",
          header: "Metodo de pago",
          hideBelow: "md",
          render: (pago) => (
            <span className="whitespace-nowrap">{pago.metodoPagoNombre?.trim() || "Sin metodo"}</span>
          ),
        },
        {
          key: "cicloPago",
          header: "Ciclo de facturacion",
          hideBelow: "2xl",
          render: (pago) =>
            pago.estado === "reembolsado" ? EMPTY_VALUE : getCicloPagoLabel(pago.cicloPago),
        },
        {
          key: "fechaInicio",
          header: "Fecha de inicio",
          hideBelow: "xl",
          render: (pago) => (
            <span className="whitespace-nowrap">
              {pago.estado === "reembolsado" || !pago.fechaInicio
                ? EMPTY_VALUE
                : formatearFecha(new Date(pago.fechaInicio))}
            </span>
          ),
        },
        {
          key: "fechaVencimiento",
          header: "Fecha de fin",
          hideBelow: "xl",
          render: (pago) => (
            <span className="whitespace-nowrap">
              {pago.estado === "reembolsado" || !pago.fechaVencimiento
                ? EMPTY_VALUE
                : formatearFecha(new Date(pago.fechaVencimiento))}
            </span>
          ),
        },
        {
          key: "precio",
          header: "Precio",
          align: "center",
          hideBelow: "lg",
          render: (pago) =>
            pago.estado === "reembolsado"
              ? EMPTY_VALUE
              : `${getCurrencySymbol(pago.moneda || moneda)} ${pago.precio.toFixed(2)}`,
        },
        {
          key: "descuento",
          header: "Descuento",
          align: "center",
          hideBelow: "2xl",
          render: (pago) => (
            <span className="text-danger">
              {pago.estado === "reembolsado"
                ? EMPTY_VALUE
                : `% ${(pago.descuento > 0 ? pago.descuento : 0).toFixed(2)}`}
            </span>
          ),
        },
        {
          key: "total",
          header: "Total",
          align: "center",
          render: (pago) => (
            <span className={cn("font-semibold", pago.estado === "reembolsado" && "text-danger")}>
              {pago.estado === "reembolsado" ? "-" : ""}
              {getCurrencySymbol(pago.moneda || moneda)} {pago.total.toFixed(2)}
            </span>
          ),
        },
      ]),
    [moneda],
  );

  return (
    <>
      <DataTable
        bare
        data={pagos}
        columns={columns}
        emptyMessage="No hay pagos registrados"
        actions={(pago) => {
          const esInicial =
            (pago.isPagoInicial ?? false) || pago.descripcion.toLowerCase() === "pago inicial";
          const puedeGestionar =
            canManagePagos &&
            pago === pagos[0] &&
            !esInicial &&
            pago.estado !== "reembolsado" &&
            pago.estado !== "anulado";

          return puedeGestionar ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Acciones del pago">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(pago)}>
                  <Edit />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(pago)}>
                  <Trash2 />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-muted-foreground">{EMPTY_VALUE}</span>
          );
        }}
      />

      <div className="flex items-center justify-between border-t px-4 py-3">
        <span className="text-sm text-muted-foreground">Ingreso Total:</span>
        <span className="text-base font-semibold text-primary">
          {isCalculatingTotal ? (
            <span className="text-xs">Calculando...</span>
          ) : (
            formatAggregateInUSD(totalIngresosUSD)
          )}
        </span>
      </div>
    </>
  );
});
