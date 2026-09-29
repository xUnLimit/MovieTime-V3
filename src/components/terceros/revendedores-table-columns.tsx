import { MessageCircle, Monitor } from "lucide-react";

import type { Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { getTerceroMetodoPagoNombre } from "@/platform/utils/terceroMetodoPago";
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
      render: (item) => (
        <div className="font-medium">
          {item.nombre} {item.apellido}
        </div>
      ),
    },
    {
      key: "tipo",
      hideBelow: "lg",
      header: "Tipo",
      sortable: false,
      align: "center",
      render: () => <span>Revendedor</span>,
    },
    {
      key: "metodoPagoNombre",
      hideBelow: "xl",
      header: "Método de Pago",
      sortable: false,
      align: "center",
      render: (item) =>
        getTerceroMetodoPagoNombre(item.metodoPagoId, item.metodoPagoNombre),
    },
    {
      key: "ventasActivas",
      header: "Servicios Activos",
      sortable: true,
      align: "center",
      render: (item) => {
        const serviciosActivos = item.serviciosActivos ?? 0;
        const isActive = serviciosActivos > 0;
        return (
          <div className="flex items-center justify-center gap-2">
            <Monitor
              className={`h-4 w-4 ${isActive ? "text-success" : "text-muted-foreground"}`}
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
      hideBelow: "md",
      header: "Monto Sin Consumir",
      sortable: true,
      align: "center",
      render: (item) => {
        const isActive = (item.serviciosActivos ?? 0) > 0;
        const monto = ventasPorTercero[item.id]?.montoSinConsumir ?? 0;
        return (
          <div className="flex items-center justify-center gap-1">
            <span
              className={
                isActive
                  ? "font-medium text-success"
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
      hideBelow: "sm",
      header: "Contacto",
      align: "center",
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            handleWhatsApp(item);
          }}
          className="h-auto p-0 text-success hover:text-success"
        >
          <MessageCircle className="mr-1 h-4 w-4" />
          WhatsApp
        </Button>
      ),
    },
  ];
}
