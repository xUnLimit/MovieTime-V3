import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/platform/utils";
import { calcularDiasRestantes, formatearFecha } from "@/platform/utils/calculations";
import type {
  PerfilDetalleVisual,
  PerfilesDetalleResumen,
  ServicioPerfilDetalle,
} from "@/features/ventas/ventas-form-shared";

const CICLO_LABEL: Record<string, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

interface VentaPerfilDetalleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicio: ServicioPerfilDetalle;
  resumen: PerfilesDetalleResumen;
  perfiles: PerfilDetalleVisual[];
  loading: boolean;
  error: string | null;
  pendingLabel: string;
}

export function VentaPerfilDetalleDialog({
  open,
  onOpenChange,
  servicio,
  resumen,
  perfiles,
  loading,
  error,
  pendingLabel,
}: VentaPerfilDetalleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pb-2 pt-5 pr-20">
          <DialogTitle className="flex items-start justify-between gap-3">
            <span className="min-w-0 pr-2 text-base leading-tight whitespace-normal break-words">
              Perfiles de {servicio?.nombre || "Servicio"}
            </span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground sm:text-sm">
              {resumen.total} perfiles registrados
            </span>
          </DialogTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {servicio?.correo || "Sin correo"} - {resumen.disponibles} de{" "}
            {resumen.total} Disponibles
          </p>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando perfiles...
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          ) : (
            <>
              <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-lg border p-2">
                {perfiles.map((perfil) => (
                  <div
                    key={perfil.numero}
                    className={cn(
                      "min-h-[64px] rounded-md border px-3 py-2",
                      perfil.estado === "ocupado" &&
                        "border-green-900/50 bg-green-950/30",
                      perfil.estado === "disponible" &&
                        "border-border bg-muted/50",
                      perfil.estado === "pendiente" &&
                        "border-purple-500/30 bg-purple-500/10",
                    )}
                  >
                    <div className="flex min-h-[40px] items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {perfil.perfilNombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Perfil {perfil.numero}
                        </p>
                        {perfil.clienteNombre ? (
                          <p className="mt-1 truncate text-xs text-foreground/90">
                            {perfil.clienteNombre}
                          </p>
                        ) : null}
                        {perfil.estado === "ocupado" && perfil.fechaFin ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Vence: {formatearFecha(perfil.fechaFin)}{" "}
                            <span className={cn(
                              "font-medium",
                              calcularDiasRestantes(perfil.fechaFin) <= 7
                                ? "text-red-400"
                                : calcularDiasRestantes(perfil.fechaFin) <= 30
                                  ? "text-yellow-400"
                                  : "text-muted-foreground",
                            )}>
                              ({calcularDiasRestantes(perfil.fechaFin)}d)
                            </span>
                          </p>
                        ) : null}
                      </div>
                      <div className="flex min-h-[40px] shrink-0 flex-col items-end justify-between gap-2 self-stretch">
                        <span
                          className={cn(
                            "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
                            perfil.estado === "ocupado" &&
                              "bg-green-600/20 text-green-300",
                            perfil.estado === "disponible" &&
                              "bg-blue-600/20 text-blue-300",
                            perfil.estado === "pendiente" &&
                              "bg-purple-500/20 text-purple-300",
                          )}
                        >
                          {perfil.estado === "ocupado"
                            ? "En uso"
                            : perfil.estado === "pendiente"
                              ? "Pendiente"
                              : "Disponible"}
                        </span>
                        {perfil.estado === "ocupado" && perfil.cicloPago ? (
                          <p className="text-right text-xs text-muted-foreground">
                            {CICLO_LABEL[perfil.cicloPago] ?? perfil.cicloPago}
                          </p>
                        ) : null}
                        {perfil.estado === "pendiente" ? (
                          <p className="text-right text-xs text-purple-300">
                            {pendingLabel}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-600" />
                    En uso
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    Disponible
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    Pendiente
                  </span>
                </div>
                <span>
                  {resumen.disponibles} de {resumen.total} Disponibles
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
