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
                className={`flex items-center justify-center w-7 h-7 rounded-full ${esActivar ? "bg-success-subtle" : "bg-danger-subtle"}`}
              >
                {esActivar ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-danger" />
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
                    ? "border-success-border bg-success-subtle text-success"
                    : "border-danger-border bg-danger-subtle text-danger"
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
                      ? "border-success-border bg-success-subtle"
                      : "border-danger-border bg-danger-subtle"
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
                      className={`h-3.5 w-3.5 ${esActivar ? "text-success" : "text-danger"}`}
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
                      ? "border-success-border bg-success-subtle"
                      : "border-danger-border bg-danger-subtle"
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
                      className={`h-3.5 w-3.5 ${esActivar ? "text-success" : "text-danger"}`}
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
                ? "bg-success hover:bg-success/90"
                : "bg-danger hover:bg-danger/90"
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
