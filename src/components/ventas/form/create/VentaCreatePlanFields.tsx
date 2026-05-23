import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import type { VentaItemErrors } from "@/features/ventas/ventas-form-shared";
import type { Categoria, Plan } from "@/types";

interface VentaCreatePlanFieldsProps {
  categoriaId: string;
  categorias: Categoria[];
  categoriasOrdenadas: Categoria[];
  itemErrors: VentaItemErrors;
  onCategoriaSelect: (categoriaId: string) => void;
  onPlanSelect: (plan: Plan) => void;
  onTipoPlanSelect: (tipoPlanId: string) => void;
  planId: string;
  planSeleccionado?: Plan;
  planesDisponibles: Plan[];
  tipoPlanId: string;
  tiposPlanes: { id: string; nombre: string }[];
}

export function VentaCreatePlanFields({
  categoriaId,
  categorias,
  categoriasOrdenadas,
  itemErrors,
  onCategoriaSelect,
  onPlanSelect,
  onTipoPlanSelect,
  planId,
  planSeleccionado,
  planesDisponibles,
  tipoPlanId,
  tiposPlanes,
}: VentaCreatePlanFieldsProps) {
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
              {categoriaId
                ? categorias.find((categoria) => categoria.id === categoriaId)
                    ?.nombre
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
                onClick={() => onCategoriaSelect(categoria.id)}
              >
                {categoria.nombre}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {itemErrors.categoria ? (
          <p className="text-sm text-red-500">{itemErrors.categoria}</p>
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
                disabled={!categoriaId}
              >
                {tipoPlanId
                  ? tiposPlanes.find((tipo) => tipo.id === tipoPlanId)?.nombre
                  : categoriaId
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
                  onClick={() => onTipoPlanSelect(tipo.id)}
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
              disabled={!categoriaId || (tiposPlanes.length > 1 && !tipoPlanId)}
            >
              {planId
                ? planSeleccionado?.nombre
                : tiposPlanes.length > 1 && !tipoPlanId
                  ? "Primero selecciona tipo"
                  : categoriaId
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
              <DropdownMenuItem key={plan.id} onClick={() => onPlanSelect(plan)}>
                {plan.nombre}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {itemErrors.plan ? (
          <p className="text-sm text-red-500">{itemErrors.plan}</p>
        ) : null}
      </div>
    </div>
  );
}
