import type { WheelEvent } from "react";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn } from "@/platform/utils";
import type { Servicio } from "@/types";

interface VentaServicioSelectorProps {
  categoriaId?: string;
  planId?: string;
  requirePlan?: boolean;
  servicioId?: string;
  servicioSeleccionado?: Servicio;
  servicios: Servicio[];
  totalServicios: number;
  visibleRows: number;
  loading: boolean;
  error?: string;
  getSlotsDisponibles: (servicioId: string) => number;
  getDisponiblesColorClass: (disponibles: number, total: number) => string;
  onSelectServicio: (servicio: Servicio) => void;
  onOpenPerfilDetalle: (servicio: Servicio) => void;
  onScroll: (direction: "up" | "down") => void;
  onWheel: (event: WheelEvent<HTMLDivElement>) => void;
}

export function VentaServicioSelector({
  categoriaId,
  planId,
  requirePlan = false,
  servicioId,
  servicioSeleccionado,
  servicios,
  totalServicios,
  visibleRows,
  loading,
  error,
  getSlotsDisponibles,
  getDisponiblesColorClass,
  onSelectServicio,
  onOpenPerfilDetalle,
  onScroll,
  onWheel,
}: VentaServicioSelectorProps) {
  const hasScrollControls = totalServicios > visibleRows;
  const isDisabled = loading || !categoriaId || (requirePlan && !planId);

  return (
    <div className="space-y-2">
      <Label>Servicio</Label>
      <DropdownMenu>
        <div className="relative">
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              type="button"
              className="w-full justify-start pr-16 text-left"
              disabled={isDisabled}
            >
              <span className="truncate">
                {loading
                  ? "Cargando servicios..."
                  : servicioId
                    ? `${servicioSeleccionado?.nombre} - ${servicioSeleccionado?.correo}`
                    : categoriaId
                      ? requirePlan && !planId
                        ? "Primero selecciona plan"
                        : "Seleccionar servicio"
                      : "Primero selecciona categoria"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          {servicioSeleccionado ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-8 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenPerfilDetalle(servicioSeleccionado);
              }}
              aria-label={`Ver detalle de perfiles de ${servicioSeleccionado.nombre}`}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
        </div>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {totalServicios > 0 ? (
            <>
              {hasScrollControls ? (
                <button
                  type="button"
                  className="flex h-6 w-full items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onScroll("up");
                  }}
                  aria-label="Subir en la lista de servicios"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
              ) : null}

              <div
                onWheel={onWheel}
                className="overflow-hidden"
                style={{ overscrollBehavior: "contain" }}
              >
                {servicios.map((servicio) => {
                  const perfilesDisponibles = getSlotsDisponibles(servicio.id);
                  const totalPerfiles = servicio.perfilesDisponibles || 0;

                  return (
                    <DropdownMenuItem
                      key={servicio.id}
                      onClick={() => onSelectServicio(servicio)}
                      className="group flex h-8 min-h-8 items-center gap-0 py-0 pr-1 leading-none"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {servicio.nombre} - {servicio.correo}
                      </span>
                      <span className="w-[112px] shrink-0 whitespace-nowrap pr-1 text-right text-xs tabular-nums text-foreground">
                        <span
                          className={cn(
                            "font-semibold",
                            getDisponiblesColorClass(
                              perfilesDisponibles,
                              totalPerfiles,
                            ),
                          )}
                        >
                          {perfilesDisponibles}
                        </span>{" "}
                        Disponible{perfilesDisponibles === 1 ? "" : "s"}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onOpenPerfilDetalle(servicio);
                        }}
                        aria-label={`Ver detalle de perfiles de ${servicio.nombre}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuItem>
                  );
                })}
              </div>

              {hasScrollControls ? (
                <button
                  type="button"
                  className="flex h-6 w-full items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onScroll("down");
                  }}
                  aria-label="Bajar en la lista de servicios"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </>
          ) : (
            <DropdownMenuItem disabled className="text-muted-foreground">
              No hay servicios disponibles
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
