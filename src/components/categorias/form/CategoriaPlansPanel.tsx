import { ChevronDown, Plus, Tag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Plan, TipoPlanConfig } from "@/types";

import { getCicloPagoLabel } from "./categoria-form-helpers";

interface CategoriaPlansPanelProps {
  planesDeTipoActual: Plan[];
  tipoActual?: TipoPlanConfig;
  onAddPlan: (tipoPlanId: string) => void;
  onDeletePlan: (id: string) => void;
  onUpdatePlan: (id: string, campo: keyof Plan, valor: string | number) => void;
}

export function CategoriaPlansPanel({
  planesDeTipoActual,
  tipoActual,
  onAddPlan,
  onDeletePlan,
  onUpdatePlan,
}: CategoriaPlansPanelProps) {
  return (
    <div className="flex-1 space-y-4">
      {!tipoActual ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
          <Tag className="h-8 w-8 text-muted-foreground mb-3 opacity-40" />
          <p className="text-sm font-medium text-muted-foreground">
            Sin tipo seleccionado
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea un tipo de plan a la izquierda para comenzar
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold">
                Planes — {tipoActual.nombre}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {planesDeTipoActual.length} plan
                {planesDeTipoActual.length !== 1 ? "es" : ""} para este tipo
              </p>
            </div>
            <Button
              type="button"
              onClick={() => onAddPlan(tipoActual.id)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Plan
            </Button>
          </div>

          {planesDeTipoActual.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/10">
              <p className="text-sm text-muted-foreground">
                No hay planes para <strong>{tipoActual.nombre}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Haz clic en &quot;Agregar Plan&quot; para crear el primero
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {planesDeTipoActual.map((plan, index) => (
                <div key={plan.id} className="p-4 border rounded-lg bg-card space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Plan {index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeletePlan(plan.id)}
                      className="h-8 w-8 text-danger hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`plan-nombre-${plan.id}`}>
                        Nombre del Plan
                      </Label>
                      <Input
                        id={`plan-nombre-${plan.id}`}
                        value={plan.nombre}
                        onChange={(e) =>
                          onUpdatePlan(plan.id, "nombre", e.target.value)
                        }
                        placeholder="Ej: Mensual, Premium"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`plan-precio-${plan.id}`}>Precio</Label>
                      <Input
                        id={`plan-precio-${plan.id}`}
                        type="text"
                        inputMode="decimal"
                        value={plan.precio === 0 ? "" : plan.precio.toString()}
                        onChange={(e) => {
                          const val = e.target.value.replace(",", ".");
                          if (/^\d*\.?\d*$/.test(val)) {
                            const parsed = parseFloat(val);
                            onUpdatePlan(
                              plan.id,
                              "precio",
                              isNaN(parsed) ? 0 : parsed,
                            );
                            if (val.endsWith(".")) {
                              e.target.value = val;
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const val = e.target.value.replace(",", ".");
                          onUpdatePlan(plan.id, "precio", parseFloat(val) || 0);
                        }}
                        placeholder="$0.00"
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`plan-ciclo-${plan.id}`}>
                        Período de Tiempo
                      </Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                            type="button"
                          >
                            {getCicloPagoLabel(plan.cicloPago)}
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-[var(--radix-dropdown-menu-trigger-width)]"
                        >
                          <DropdownMenuItem
                            onClick={() =>
                              onUpdatePlan(plan.id, "cicloPago", "mensual")
                            }
                          >
                            Mensual
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              onUpdatePlan(plan.id, "cicloPago", "trimestral")
                            }
                          >
                            Trimestral
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              onUpdatePlan(plan.id, "cicloPago", "semestral")
                            }
                          >
                            Semestral
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              onUpdatePlan(plan.id, "cicloPago", "anual")
                            }
                          >
                            Anual
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
