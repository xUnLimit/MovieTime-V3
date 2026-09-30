import type { WheelEvent } from "react";
import { ChevronDown } from "lucide-react";
import type {
  FieldErrors,
  UseFormClearErrors,
  UseFormSetValue,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { VentaServicioSelector } from "@/components/ventas/form/VentaServicioSelector";
import type { VentaEditFormData } from "@/components/ventas/form/venta-edit-form-schema";
import type { Servicio } from "@/types";

interface VentaEditServiceProfileFieldsProps {
  categoriaIdValue: string;
  clearErrors: UseFormClearErrors<VentaEditFormData>;
  errors: FieldErrors<VentaEditFormData>;
  getDisponiblesColorClass: (disponibles: number, total: number) => string;
  getSlotsDisponibles: (servicioId: string) => number;
  loadingServicios: boolean;
  onOpenPerfilDetalle: (servicio: Servicio) => Promise<void> | void;
  onScrollServicios: (direction: "up" | "down") => void;
  onWheelServicios: (event: WheelEvent<HTMLDivElement>) => void;
  perfilNumeroValue?: string;
  perfilesDropdown: number[];
  planIdValue: string;
  servicioIdValue: string;
  servicioSeleccionado?: Servicio;
  serviciosVentana: Servicio[];
  setValue: UseFormSetValue<VentaEditFormData>;
  totalServicios: number;
  visibleServiciosRows: number;
}

export function VentaEditServiceProfileFields({
  categoriaIdValue,
  clearErrors,
  errors,
  getDisponiblesColorClass,
  getSlotsDisponibles,
  loadingServicios,
  onOpenPerfilDetalle,
  onScrollServicios,
  onWheelServicios,
  perfilNumeroValue,
  perfilesDropdown,
  planIdValue,
  servicioIdValue,
  servicioSeleccionado,
  serviciosVentana,
  setValue,
  totalServicios,
  visibleServiciosRows,
}: VentaEditServiceProfileFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <VentaServicioSelector
        categoriaId={categoriaIdValue}
        planId={planIdValue}
        requirePlan
        servicioId={servicioIdValue}
        servicioSeleccionado={servicioSeleccionado}
        servicios={serviciosVentana}
        totalServicios={totalServicios}
        visibleRows={visibleServiciosRows}
        loading={loadingServicios}
        error={errors.servicioId?.message}
        getSlotsDisponibles={getSlotsDisponibles}
        getDisponiblesColorClass={getDisponiblesColorClass}
        onOpenPerfilDetalle={(servicio) => {
          void onOpenPerfilDetalle(servicio);
        }}
        onScroll={onScrollServicios}
        onWheel={onWheelServicios}
        onSelectServicio={(servicio) => {
          setValue("servicioId", servicio.id);
          setValue("perfilNumero", "");
          setValue("perfilNombre", "");
          clearErrors("servicioId");
          clearErrors("perfilNumero");
        }}
      />

      <div className="space-y-2">
        <Label>Perfil</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              type="button"
              className="w-full justify-between"
              disabled={
                !servicioIdValue || getSlotsDisponibles(servicioIdValue) <= 0
              }
            >
              {perfilNumeroValue
                ? `Perfil ${perfilNumeroValue}`
                : getSlotsDisponibles(servicioIdValue) > 0
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
              {getSlotsDisponibles(servicioIdValue) <= 0 ? (
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
                    onClick={() => {
                      setValue("perfilNumero", String(numero));
                      clearErrors("perfilNumero");
                    }}
                  >
                    Perfil {numero}
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        {errors.perfilNumero ? (
          <p className="text-sm text-danger">
            {errors.perfilNumero.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
