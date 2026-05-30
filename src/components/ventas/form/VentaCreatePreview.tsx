import { MessageCircle } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatearFecha } from "@/platform/utils/calculations";
import type { VentaItem } from "@/features/ventas/ventas-form-shared";

interface VentaCreatePreviewProps {
  clienteNombre: string;
  metodoPagoNombre: string;
  items: VentaItem[];
  simboloMoneda: string;
  totalFinal: number;
  notifyCliente: boolean;
  estado: "activo" | "inactivo";
  editedMessage: string;
  onNotifyClienteChange: (checked: boolean) => void;
  onEditedMessageChange: (message: string) => void;
}

export function VentaCreatePreview({
  clienteNombre,
  metodoPagoNombre,
  items,
  simboloMoneda,
  totalFinal,
  notifyCliente,
  estado,
  editedMessage,
  onNotifyClienteChange,
  onEditedMessageChange,
}: VentaCreatePreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-0">
          <h2 className="text-lg font-semibold">Vista previa de la venta</h2>
          <p className="-mt-1 text-sm text-muted-foreground">
            Resumen general antes de guardar.
          </p>
        </div>
      </div>

      <div className="mt-0 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-background/40 p-4">
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="text-sm font-medium">{clienteNombre}</p>
        </div>
        <div className="rounded-lg border bg-background/40 p-4">
          <p className="text-xs text-muted-foreground">Método de pago</p>
          <p className="text-sm font-medium">{metodoPagoNombre}</p>
        </div>
      </div>

      <div className="mt-0 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Items agregados</h3>
          <span className="text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border bg-background/40 p-6 text-center text-sm text-muted-foreground">
            No hay items agregados.
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="w-full rounded-lg border bg-background/40 p-4 md:w-[280px] md:flex-[0_0_auto]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.servicioNombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.cicloPago
                        ? `${item.cicloPago.charAt(0).toUpperCase()}${item.cicloPago.slice(1)}`
                        : "—"}
                    </p>
                  </div>
                  <span className="font-semibold text-green-500">
                    {simboloMoneda} {item.precioFinal.toFixed(2)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <p>Fecha de inicio</p>
                    <p className="font-medium text-foreground">
                      {item.fechaInicio ? formatearFecha(item.fechaInicio) : "—"}
                    </p>
                  </div>
                  <div>
                    <p>Fecha de fin</p>
                    <p className="font-medium text-foreground">
                      {item.fechaFin ? formatearFecha(item.fechaFin) : "—"}
                    </p>
                  </div>
                  <div>
                    <p>Precio</p>
                    <p className="font-medium text-foreground">
                      {simboloMoneda} {item.precio.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p>Descuento</p>
                    <p className="font-medium text-foreground">
                      {item.descuento.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <p>Nombre del perfil</p>
                    <p className="font-medium text-foreground">
                      {item.perfilNombre?.trim() ? item.perfilNombre : "—"}
                    </p>
                  </div>
                  <div>
                    <p>Codigo</p>
                    <p className="font-medium text-foreground">
                      {item.codigo || "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <p>Precio final</p>
                  <p className="font-medium text-foreground">
                    {simboloMoneda} {item.precioFinal.toFixed(2)}
                  </p>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <p>Notas</p>
                  <p className="font-medium text-foreground">
                    {item.notas ? item.notas : "Sin notas"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1 space-y-2 rounded-lg bg-muted/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">
            Total de la venta
          </span>
          <span className="text-xl font-semibold text-green-500">
            {simboloMoneda} {totalFinal.toFixed(2)}
          </span>
        </div>
        <div className="mt-0 text-sm text-muted-foreground">
          El total corresponde a la suma de todos los items agregados.
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-background/40 p-3">
        <div className="flex items-center gap-3">
          <Switch
            checked={notifyCliente}
            onCheckedChange={onNotifyClienteChange}
            disabled={estado === "inactivo"}
          />
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageCircle className="h-4 w-4 text-green-500" />
            <span>Notificar al cliente por WhatsApp</span>
          </div>
        </div>

        {notifyCliente && estado !== "inactivo" ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold">
              Editar Mensaje de Notificación
            </p>
            <p className="text-xs text-muted-foreground">
              Puedes ajustar el mensaje antes de enviarlo. Los cambios no se
              guardan en las plantillas.
            </p>
            <Textarea
              value={editedMessage}
              onChange={(event) => onEditedMessageChange(event.target.value)}
              rows={10}
              className="min-h-[220px] resize-y text-sm leading-relaxed"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
