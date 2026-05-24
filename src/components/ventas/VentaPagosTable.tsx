"use client";

import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrencySymbol } from "@/lib/constants";
import { formatAggregateInUSD, sumInUSD } from "@/lib/payments/payment-calculator";
import { formatearFecha } from "@/lib/utils/calculations";
import { queryKeys } from "@/lib/query-keys";
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
          console.error("[VentaPagosTable] Error calculating total:", error);
          return 0;
        }
      },
    });

  return (
    <>
      <div className="table-scroll-shell">
        <table className="w-full min-w-[1100px]">
          <colgroup>
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "7%" }} />
          </colgroup>
          <thead>
            <tr className="border-b text-sm text-muted-foreground">
              <th className="text-left py-3 font-medium whitespace-nowrap">
                Fecha de pago
              </th>
              <th className="text-left py-3 font-medium">Descripcion</th>
              <th className="text-left py-3 font-medium whitespace-nowrap">
                Metodo de pago
              </th>
              <th className="text-left py-3 font-medium">
                Ciclo de facturacion
              </th>
              <th className="text-left py-3 font-medium whitespace-nowrap">
                Fecha de inicio
              </th>
              <th className="text-left py-3 font-medium whitespace-nowrap">
                Fecha de fin
              </th>
              <th className="text-center py-3 font-medium">Precio</th>
              <th className="text-center py-3 font-medium">Descuento</th>
              <th className="text-center py-3 font-medium">Total</th>
              <th className="text-center py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((pago, index) => {
              const rowCurrency = getCurrencySymbol(pago.moneda || moneda);
              const esInicial =
                (pago.isPagoInicial ?? false) ||
                pago.descripcion.toLowerCase() === "pago inicial";
              const esReembolso = pago.estado === "reembolsado";
              const esUltimo = index === 0;
              const puedeGestionar =
                canManagePagos && esUltimo && !esInicial && !esReembolso && pago.estado !== "anulado";
              const metodoPagoNombre =
                pago.metodoPagoNombre?.trim() || "Sin metodo";
              const fechaPago = pago.fecha ? formatearFecha(new Date(pago.fecha)) : EMPTY_VALUE;
              const fechaInicio = pago.fechaInicio ? formatearFecha(new Date(pago.fechaInicio)) : EMPTY_VALUE;
              const fechaFin = pago.fechaVencimiento ? formatearFecha(new Date(pago.fechaVencimiento)) : EMPTY_VALUE;
              const refundClass = esReembolso ? "text-red-600 dark:text-red-400" : "";

              return (
                <tr
                  key={`${pago.id ?? pago.descripcion}-${index}`}
                  className="border-b text-sm"
                >
                  <td className="py-3 whitespace-nowrap">{fechaPago}</td>
                  <td className={`py-3 font-medium ${refundClass}`}>
                    {pago.descripcion}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    {metodoPagoNombre}
                  </td>
                  <td className="py-3">
                    {esReembolso ? EMPTY_VALUE : getCicloPagoLabel(pago.cicloPago)}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    {esReembolso ? EMPTY_VALUE : fechaInicio}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    {esReembolso ? EMPTY_VALUE : fechaFin}
                  </td>
                  <td className="py-3 text-center">
                    {esReembolso ? EMPTY_VALUE : `${rowCurrency} ${pago.precio.toFixed(2)}`}
                  </td>
                  <td className="py-3 text-center text-red-500">
                    {esReembolso
                      ? EMPTY_VALUE
                      : pago.descuento > 0
                        ? `% ${pago.descuento.toFixed(2)}`
                        : `% 0.00`}
                  </td>
                  <td className={`py-3 text-center font-semibold ${refundClass}`}>
                    {esReembolso ? "-" : ""}{rowCurrency} {pago.total.toFixed(2)}
                  </td>
                  <td className="py-3 text-center">
                    {puedeGestionar ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center">
                          <DropdownMenuItem onClick={() => onEdit(pago)}>
                            <Edit className="h-3.5 w-3.5 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(pago)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <div className="h-7 flex items-center justify-center text-muted-foreground">
                        {EMPTY_VALUE}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pt-3 border-t flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Ingreso Total:</span>
        <span className="text-lg font-semibold text-purple-600 dark:text-purple-400">
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
