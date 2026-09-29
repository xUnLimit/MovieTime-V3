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
import type { VentaEditFormData } from "@/features/ventas/venta-edit-form-schema";
import { MESES_POR_CICLO } from "@/features/ventas/ventas-form-shared";
import type { Categoria, Plan } from "@/types";

interface VentaEditPlanFieldsProps {
  categoriaIdValue: string;
  categoriaSeleccionada?: Categoria;
  categoriasOrdenadas: Categoria[];
  clearErrors: UseFormClearErrors<VentaEditFormData>;
  errors: FieldErrors<VentaEditFormData>;
  fechaInicioValue?: Date;
  onTipoPlanSelect: (tipoPlanId: string) => void;
  planSeleccionado?: Plan;
  planesDisponibles: Plan[];
  setValue: UseFormSetValue<VentaEditFormData>;
  tipoPlanId: string;
  tiposPlanes: { id: string; nombre: string }[];
}

export function VentaEditPlanFields({
  categoriaIdValue,
  categoriaSeleccionada,
  categoriasOrdenadas,
  clearErrors,
  errors,
  fechaInicioValue,
  onTipoPlanSelect,
  planSeleccionado,
  planesDisponibles,
  setValue,
  tipoPlanId,
  tiposPlanes,
}: VentaEditPlanFieldsProps) {
  return (
    <div
      className={`grid grid-cols-1 gap-6 ${
        tiposPlanes.length > 1 ? "md:grid-cols-3" : "md:grid-cols-2"
      }`}
    >
      <div className="space-y-2">
        <Label>Categoria</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              type="button"
              className="w-full justify-between"
            >
              {categoriaSeleccionada
                ? categoriaSeleccionada.nombre
                : "Seleccionar categoria"}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)]"
          >
            {categoriasOrdenadas.map((categoria) => (
              <DropdownMenuItem
                key={categoria.id}
                onClick={() => {
                  setValue("categoriaId", categoria.id);
                  onTipoPlanSelect("");
                  setValue("servicioId", "");
                  setValue("planId", "");
                  setValue("perfilNumero", "");
                  setValue("perfilNombre", "");
                  clearErrors("categoriaId");
                }}
              >
                {categoria.nombre}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {errors.categoriaId ? (
          <p className="text-sm text-danger">
            {errors.categoriaId.message}
          </p>
        ) : null}
      </div>

      {tiposPlanes.length > 1 ? (
        <div className="space-y-2">
          <Label>Tipo de plan</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className="w-full justify-between"
                disabled={!categoriaIdValue}
              >
                {tipoPlanId
                  ? tiposPlanes.find((tipo) => tipo.id === tipoPlanId)?.nombre
                  : categoriaIdValue
                    ? "Seleccionar tipo"
                    : "Primero selecciona categoria"}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {tiposPlanes.map((tipo) => (
                <DropdownMenuItem
                  key={tipo.id}
                  onClick={() => {
                    onTipoPlanSelect(tipo.id);
                    setValue("servicioId", "");
                    setValue("planId", "");
                    setValue("perfilNumero", "");
                    setValue("perfilNombre", "");
                    clearErrors("servicioId");
                    clearErrors("planId");
                    clearErrors("perfilNumero");
                  }}
                >
                  {tipo.nombre}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Plan</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              type="button"
              className="w-full justify-between"
              disabled={!categoriaIdValue || (tiposPlanes.length > 1 && !tipoPlanId)}
            >
              {planSeleccionado
                ? planSeleccionado.nombre
                : tiposPlanes.length > 1 && !tipoPlanId
                  ? "Primero selecciona tipo"
                  : categoriaIdValue
                    ? "Seleccionar plan"
                    : "Primero selecciona categoria"}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)]"
          >
            {planesDisponibles.map((plan) => (
              <DropdownMenuItem
                key={plan.id}
                onClick={() => {
                  setValue("planId", plan.id);
                  setValue("servicioId", "");
                  setValue("perfilNumero", "");
                  setValue("perfilNombre", "");
                  if (fechaInicioValue) {
                    const meses = MESES_POR_CICLO[plan.cicloPago] ?? 1;
                    const fechaFin = new Date(fechaInicioValue);
                    fechaFin.setMonth(fechaFin.getMonth() + meses);
                    setValue("fechaFin", fechaFin);
                  }
                  clearErrors("planId");
                  clearErrors("servicioId");
                  clearErrors("perfilNumero");
                }}
              >
                {plan.nombre}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {errors.planId ? (
          <p className="text-sm text-danger">{errors.planId.message}</p>
        ) : null}
      </div>
    </div>
  );
}
