"use client";

import { memo, useEffect, useState } from "react";
import { Edit, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrencySymbol } from "@/lib/constants";
import {
  formatearFecha,
  sumInUSD,
  formatAggregateInUSD,
} from "@/lib/utils/calculations";
import { VentaPago } from "@/types";

interface VentaPagosTableProps {
  pagos: VentaPago[];
  moneda: string;
  canManagePagos: boolean;
  onEdit: (pago: VentaPago) => void;
  onDelete: (pago: VentaPago) => void;
}

const getCicloPagoLabel = (ciclo?: string | null) => {
  const labels: Record<string, string> = {
    mensual: "Mensual",
    trimestral: "Trimestral",
    semestral: "Semestral",
    anual: "Anual",
  };
  return ciclo ? labels[ciclo] || ciclo : "—";
};

export const VentaPagosTable = memo(function VentaPagosTable({
  pagos,
  moneda,
  canManagePagos,
  onEdit,
  onDelete,
}: VentaPagosTableProps) {
  const [totalIngresosUSD, setTotalIngresosUSD] = useState<number>(0);
  const [isCalculatingTotal, setIsCalculatingTotal] = useState(false);

  useEffect(() => {
    const calculateTotal = async () => {
      setIsCalculatingTotal(true);
      try {
        const total = await sumInUSD(
          pagos.map((p) => ({
            monto: p.total ?? 0,
            moneda: p.moneda || moneda || "USD",
          })),
        );
        setTotalIngresosUSD(total);
      } catch (error) {
        console.error("[VentaPagosTable] Error calculating total:", error);
        setTotalIngresosUSD(0);
      } finally {
        setIsCalculatingTotal(false);
      }
    };
    calculateTotal();
  }, [pagos, moneda]);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: "16%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead>
            <tr className="border-b text-sm text-muted-foreground">
              <th className="text-left py-3 font-medium whitespace-nowrap">
                Fecha de Pago
              </th>
              <th className="text-left py-3 font-medium">Descripción</th>
              <th className="text-left py-3 font-medium">
                Ciclo de facturación
              </th>
              <th className="text-left py-3 font-medium whitespace-nowrap">
                Fecha de Inicio
              </th>
              <th className="text-left py-3 font-medium whitespace-nowrap">
                Fecha de Fin
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
              const esUltimo = index === 0;
              const puedeGestionar = canManagePagos && esUltimo && !esInicial;

              return (
                <tr
                  key={`${pago.descripcion}-${index}`}
                  className="border-b text-sm"
                >
                  <td className="py-3 whitespace-nowrap">
                    {pago.fecha ? formatearFecha(new Date(pago.fecha)) : "—"}
                  </td>
                  <td className="py-3 font-medium">{pago.descripcion}</td>
                  <td className="py-3">{getCicloPagoLabel(pago.cicloPago)}</td>
                  <td className="py-3 whitespace-nowrap">
                    {pago.fechaInicio
                      ? formatearFecha(new Date(pago.fechaInicio))
                      : "—"}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    {pago.fechaVencimiento
                      ? formatearFecha(new Date(pago.fechaVencimiento))
                      : "—"}
                  </td>
                  <td className="py-3 text-center">
                    {rowCurrency} {pago.precio.toFixed(2)}
                  </td>
                  <td className="py-3 text-center text-red-500">
                    {pago.descuento > 0
                      ? `% ${pago.descuento.toFixed(2)}`
                      : `% 0.00`}
                  </td>
                  <td className="py-3 text-center font-semibold">
                    {rowCurrency} {pago.total.toFixed(2)}
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
                        —
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
