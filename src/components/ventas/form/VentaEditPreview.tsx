import { formatearFecha } from "@/platform/utils/calculations";

interface VentaEditPreviewProps {
  clienteNombre: string;
  metodoPagoNombre: string;
  servicioNombre: string;
  cicloLabel: string;
  simboloMoneda: string;
  precioFinal: number;
  fechaInicio?: Date;
  fechaFin?: Date;
  precioBase: number;
  descuento: number;
  perfilNombre?: string;
  codigo?: string;
  notas?: string;
}

export function VentaEditPreview({
  clienteNombre,
  metodoPagoNombre,
  servicioNombre,
  cicloLabel,
  simboloMoneda,
  precioFinal,
  fechaInicio,
  fechaFin,
  precioBase,
  descuento,
  perfilNombre,
  codigo,
  notas,
}: VentaEditPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-0">
          <h2 className="text-base font-semibold">Vista previa de la venta</h2>
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
          <span className="text-sm text-muted-foreground">1 item</span>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="w-full rounded-lg border bg-background/40 p-4 md:w-[280px] md:flex-[0_0_auto]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{servicioNombre}</p>
                <p className="text-xs text-muted-foreground">{cicloLabel}</p>
              </div>
              <span className="font-semibold text-success">
                {simboloMoneda} {precioFinal.toFixed(2)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div>
                <p>Fecha de inicio</p>
                <p className="font-medium text-foreground">
                  {fechaInicio ? formatearFecha(fechaInicio) : "—"}
                </p>
              </div>
              <div>
                <p>Fecha de fin</p>
                <p className="font-medium text-foreground">
                  {fechaFin ? formatearFecha(fechaFin) : "—"}
                </p>
              </div>
              <div>
                <p>Precio</p>
                <p className="font-medium text-foreground">
                  {simboloMoneda} {precioBase.toFixed(2)}
                </p>
              </div>
              <div>
                <p>Descuento</p>
                <p className="font-medium text-foreground">
                  {descuento.toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div>
                <p>Nombre del perfil</p>
                <p className="font-medium text-foreground">
                  {perfilNombre?.trim() ? perfilNombre : "—"}
                </p>
              </div>
              <div>
                <p>Codigo</p>
                <p className="font-medium text-foreground">{codigo || "—"}</p>
              </div>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              <p>Precio final</p>
              <p className="font-medium text-foreground">
                {simboloMoneda} {precioFinal.toFixed(2)}
              </p>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              <p>Notas</p>
              <p className="font-medium text-foreground">
                {notas || "Sin notas"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-1 space-y-2 rounded-lg bg-muted/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-foreground">
            Total de la venta
          </span>
          <span className="text-xl font-semibold text-success">
            {simboloMoneda} {precioFinal.toFixed(2)}
          </span>
        </div>
        <div className="mt-0 text-sm text-muted-foreground">
          El total corresponde a la suma de todos los items agregados.
        </div>
      </div>
    </div>
  );
}
