import { MessageCircle, Monitor } from "lucide-react";

import type { Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { getTerceroMetodoPagoNombre } from "@/lib/utils/terceroMetodoPago";
import type { Tercero } from "@/types";

type VentasPorTerceroStats = Record<string, { montoSinConsumir?: number } | undefined>;

export function createRevendedoresColumns({
  handleWhatsApp,
  ventasPorTercero,
}: {
  handleWhatsApp: (revendedor: Tercero) => void;
  ventasPorTercero: VentasPorTerceroStats;
}): Column<Tercero>[] {
  return [
    {
      key: "nombre",
      header: "Nombre",
      sortable: true,
      width: "14%",
      render: (item) => (
        <div className="font-medium">
          {item.nombre} {item.apellido}
        </div>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      sortable: false,
      align: "center",
      width: "16%",
      render: () => <span>Revendedor</span>,
    },
    {
      key: "metodoPagoNombre",
      header: "Método de Pago",
      sortable: false,
      align: "center",
      width: "16%",
      render: (item) =>
        getTerceroMetodoPagoNombre(item.metodoPagoId, item.metodoPagoNombre),
    },
    {
      key: "ventasActivas",
      header: "Servicios Activos",
      sortable: true,
      align: "center",
      width: "16%",
      render: (item) => {
        const serviciosActivos = item.serviciosActivos ?? 0;
        const isActive = serviciosActivos > 0;
        return (
          <div className="flex items-center justify-center gap-2">
            <Monitor
              className={`h-4 w-4 ${isActive ? "text-green-500" : "text-muted-foreground"}`}
            />
            <span className={isActive ? "" : "text-muted-foreground"}>
              {serviciosActivos}
            </span>
          </div>
        );
      },
    },
    {
      key: "montoSinConsumir",
      header: "Monto Sin Consumir",
      sortable: true,
      align: "center",
      width: "16%",
      render: (item) => {
        const isActive = (item.serviciosActivos ?? 0) > 0;
        const monto = ventasPorTercero[item.id]?.montoSinConsumir ?? 0;
        return (
          <div className="flex items-center justify-center gap-1">
            <span
              className={
                isActive
                  ? "font-medium text-green-500"
                  : "text-muted-foreground"
              }
            >
              $
            </span>
            <span
              className={isActive ? "font-medium" : "text-muted-foreground"}
            >
              {monto.toFixed(2)}
            </span>
          </div>
        );
      },
    },
    {
      key: "contacto",
      header: "Contacto",
      align: "center",
      width: "16%",
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            handleWhatsApp(item);
          }}
          className="h-auto p-0 text-green-500 hover:text-green-400"
        >
          <MessageCircle className="mr-1 h-4 w-4" />
          WhatsApp
        </Button>
      ),
    },
  ];
}
