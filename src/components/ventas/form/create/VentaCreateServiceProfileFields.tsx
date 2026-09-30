import type { WheelEvent } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { VentaServicioSelector } from "@/components/ventas/form/VentaServicioSelector";
import {
  SERVICIOS_DROPDOWN_VISIBLE_ROWS,
  type VentaItemErrors,
} from "@/components/ventas/form/ventas-form-shared";
import type { Servicio } from "@/types";

interface VentaCreateServiceProfileFieldsProps {
  categoriaId: string;
  getDisponiblesColorClass: (disponibles: number, total: number) => string;
  getSlotsDisponibles: (servicioId: string) => number;
  itemErrors: VentaItemErrors;
  loadingServicios: boolean;
  loadingVentasRanking: boolean;
  onOpenPerfilDetalle: (servicio: Servicio) => void;
  onPerfilSelect: (numero: number) => void;
  onServicioSelect: (servicio: Servicio) => void;
  onServiciosScroll: (direction: "up" | "down") => void;
  onServiciosWheel: (event: WheelEvent<HTMLDivElement>) => void;
  perfilNumero: string;
  perfilesDropdown: number[];
  planId: string;
  servicioId: string;
  servicioSeleccionado?: Servicio;
  serviciosFiltradosTotal: number;
  serviciosVentana: Servicio[];
}

export function VentaCreateServiceProfileFields({
  categoriaId,
  getDisponiblesColorClass,
  getSlotsDisponibles,
  itemErrors,
  loadingServicios,
  loadingVentasRanking,
  onOpenPerfilDetalle,
  onPerfilSelect,
  onServicioSelect,
  onServiciosScroll,
  onServiciosWheel,
  perfilNumero,
  perfilesDropdown,
  planId,
  servicioId,
  servicioSeleccionado,
  serviciosFiltradosTotal,
  serviciosVentana,
}: VentaCreateServiceProfileFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <VentaServicioSelector
        categoriaId={categoriaId}
        planId={planId}
        requirePlan
        servicioId={servicioId}
        servicioSeleccionado={servicioSeleccionado}
        servicios={serviciosVentana}
        totalServicios={serviciosFiltradosTotal}
        visibleRows={SERVICIOS_DROPDOWN_VISIBLE_ROWS}
        loading={loadingServicios || loadingVentasRanking}
        error={itemErrors.servicio}
        getSlotsDisponibles={getSlotsDisponibles}
        getDisponiblesColorClass={getDisponiblesColorClass}
        onOpenPerfilDetalle={onOpenPerfilDetalle}
        onScroll={onServiciosScroll}
        onWheel={onServiciosWheel}
        onSelectServicio={onServicioSelect}
      />

      <div className="space-y-1.5">
        <Label>Perfil</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              type="button"
              className="w-full justify-between"
              disabled={!servicioId || getSlotsDisponibles(servicioId) <= 0}
            >
              {perfilNumero
                ? `Perfil ${perfilNumero}`
                : getSlotsDisponibles(servicioId) > 0
                  ? "Seleccionar perfil"
                  : "No hay perfiles disponibles"}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)] p-0"
          >
            <div className="p-1">
              {getSlotsDisponibles(servicioId) <= 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No hay perfiles disponibles.
                </p>
              ) : perfilesDropdown.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No hay perfiles libres.
                </p>
              ) : (
                perfilesDropdown.map((numero) => (
                  <DropdownMenuItem
                    key={numero}
                    onClick={() => onPerfilSelect(numero)}
                  >
                    Perfil {numero}
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        {itemErrors.perfil ? (
          <p className="text-sm text-danger">{itemErrors.perfil}</p>
        ) : null}
      </div>
    </div>
  );
}
