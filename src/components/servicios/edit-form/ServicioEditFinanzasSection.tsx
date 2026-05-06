import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MetodoPago, TipoPlanConfig } from "@/types";

import type { ServicioEditFormData } from "./schema";
import {
  getCicloLabel,
  getTipoPlanLabel,
  handleDecimalInputKeyDown,
} from "./helpers";
import type { ServicioEditFormBindings } from "./types";

interface ServicioEditFinanzasSectionProps extends ServicioEditFormBindings {
  cicloPagoValue: ServicioEditFormData["cicloPago"];
  metodoPagoNombre: string;
  metodosPagoActivos: MetodoPago[];
  simboloMoneda: string;
  tipoPlanValue: string;
  tiposPlanesDinamicos: TipoPlanConfig[];
}

export function ServicioEditFinanzasSection({
  cicloPagoValue,
  errors,
  metodoPagoNombre,
  metodosPagoActivos,
  register,
  setValue,
  simboloMoneda,
  tipoPlanValue,
  tiposPlanesDinamicos,
}: ServicioEditFinanzasSectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="metodoPago">Método de Pago</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {metodoPagoNombre}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {metodosPagoActivos.map((metodo) => (
                <DropdownMenuItem
                  key={metodo.id}
                  onClick={() => setValue("metodoPagoId", metodo.id)}
                >
                  {metodo.nombre}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.metodoPagoId && (
            <p className="text-sm text-red-500">
              {errors.metodoPagoId.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="costoServicio">Costo del servicio</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
              {simboloMoneda}
            </span>
            <Input
              id="costoServicio"
              type="text"
              inputMode="decimal"
              {...register("costoServicio")}
              placeholder="0.00"
              className={simboloMoneda.length > 1 ? "pl-10" : "pl-7"}
              onKeyDown={handleDecimalInputKeyDown}
            />
          </div>
          {errors.costoServicio && (
            <p className="text-sm text-red-500">
              {errors.costoServicio.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="tipoPlan">Tipo de Plan</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {getTipoPlanLabel(tipoPlanValue, tiposPlanesDinamicos)}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {tiposPlanesDinamicos.length === 0 ? (
                <DropdownMenuItem disabled>
                  Selecciona una categoría con tipos de plan
                </DropdownMenuItem>
              ) : (
                tiposPlanesDinamicos.map((tipo) => (
                  <DropdownMenuItem
                    key={tipo.id}
                    onClick={() => setValue("tipoPlan", tipo.id)}
                  >
                    {tipo.nombre}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.tipoPlan && (
            <p className="text-sm text-red-500">{errors.tipoPlan.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ciclo">Ciclo de Facturación</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {getCicloLabel(cicloPagoValue)}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <DropdownMenuItem
                onClick={() => setValue("cicloPago", "mensual")}
              >
                Mensual
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setValue("cicloPago", "trimestral")}
              >
                Trimestral
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setValue("cicloPago", "semestral")}
              >
                Semestral
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setValue("cicloPago", "anual")}>
                Anual
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.cicloPago && (
            <p className="text-sm text-red-500">{errors.cicloPago.message}</p>
          )}
        </div>
      </div>
    </>
  );
}
