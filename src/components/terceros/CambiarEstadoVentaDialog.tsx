"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, ShoppingCart, Monitor } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

type Alcance = "venta" | "venta_y_servicio";

interface CambiarEstadoVentaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: "activar" | "inactivar";
  venta: {
    id: string;
    servicioId: string;
    categoriaNombre: string;
    servicioNombre: string;
  } | null;
  onConfirm: (alcance: Alcance) => Promise<void>;
}

export function CambiarEstadoVentaDialog({
  open,
  onOpenChange,
  modo,
  venta,
  onConfirm,
}: CambiarEstadoVentaDialogProps) {
  const [alcance, setAlcance] = useState<Alcance>("venta");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset al abrir para una venta distinta
  useEffect(() => {
    setAlcance("venta");
  }, [venta?.id, modo]);

  if (!venta) return null;

  const esActivar = modo === "activar";

  const handleConfirmar = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(alcance);
      onOpenChange(false);
    } catch {
      // error handled in parent
    } finally {
      setIsSubmitting(false);
      setAlcance("venta");
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      setAlcance("venta");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 bg-muted/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full ${esActivar ? "bg-green-100 dark:bg-green-950/40" : "bg-red-100 dark:bg-red-950/40"}`}
              >
                {esActivar ? (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                )}
              </div>
              {esActivar ? "Activar venta" : "Inactivar venta"}
            </DialogTitle>
          </DialogHeader>

          {/* Info de la venta */}
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20 shrink-0">
                Categoría
              </span>
              <span className="font-medium">{venta.categoriaNombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20 shrink-0">
                Servicio
              </span>
              <span className="font-medium">{venta.servicioNombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20 shrink-0">
                Acción
              </span>
              <Badge
                variant="outline"
                className={
                  esActivar
                    ? "border-green-500/40 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                    : "border-red-500/40 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                }
              >
                {esActivar ? "Activar" : "Inactivar"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-4">
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              ¿Qué deseas {esActivar ? "activar" : "inactivar"}?
            </p>
            <RadioGroup
              value={alcance}
              onValueChange={(v) => setAlcance(v as Alcance)}
              className="space-y-2"
            >
              {/* Solo la venta */}
              <label
                htmlFor="opt-solo-venta"
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  alcance === "venta"
                    ? esActivar
                      ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/20"
                      : "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/20"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <RadioGroupItem
                  value="venta"
                  id="opt-solo-venta"
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <ShoppingCart
                      className={`h-3.5 w-3.5 ${esActivar ? "text-green-600" : "text-red-600"}`}
                    />
                    <span className="text-sm font-medium">Solo la venta</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {esActivar
                      ? "Cambia el estado de la venta a activo, el servicio no se modifica."
                      : "Cambia el estado de la venta a inactivo, el servicio no se modifica."}
                  </p>
                </div>
              </label>

              {/* Venta y servicio */}
              <label
                htmlFor="opt-venta-servicio"
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  alcance === "venta_y_servicio"
                    ? esActivar
                      ? "border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/20"
                      : "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/20"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <RadioGroupItem
                  value="venta_y_servicio"
                  id="opt-venta-servicio"
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Monitor
                      className={`h-3.5 w-3.5 ${esActivar ? "text-green-600" : "text-red-600"}`}
                    />
                    <span className="text-sm font-medium">
                      Venta y servicio
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {esActivar
                      ? "Activa la venta y también marca el servicio como activo."
                      : "Inactiva la venta y también marca el servicio como inactivo."}
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 pb-5 pt-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmar}
            disabled={isSubmitting}
            className={`flex-1 text-white border-transparent ${
              esActivar
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isSubmitting
              ? "Procesando..."
              : esActivar
                ? "Activar"
                : "Inactivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
