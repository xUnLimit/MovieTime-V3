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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { REPOSO_DAY_OPTIONS } from "@/lib/constants";

import {
  getEstadoLabel,
  handleIntegerInputKeyDown,
} from "./servicio-form-helpers";
import type { ServicioFormBindings } from "./types";

interface ServicioEstadoSectionProps extends ServicioFormBindings {
  diasReposoValue?: string;
  estadoValue: string;
  renovacionAutomaticaValue: boolean;
}

export function ServicioEstadoSection({
  diasReposoValue,
  errors,
  estadoValue,
  register,
  renovacionAutomaticaValue,
  setValue,
}: ServicioEstadoSectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="perfiles">Número de perfiles</Label>
          <Input
            id="perfiles"
            type="text"
            inputMode="numeric"
            {...register("perfilesDisponibles")}
            placeholder="Ingrese la cantidad"
            onKeyDown={handleIntegerInputKeyDown}
          />
          {errors.perfilesDisponibles && (
            <p className="text-sm text-red-500">
              {errors.perfilesDisponibles.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="estado">Estado</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {getEstadoLabel(estadoValue)}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <DropdownMenuItem onClick={() => setValue("estado", "activo")}>
                Activo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setValue("estado", "inactivo")}>
                Inactivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setValue("estado", "reposo")}>
                Reposo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.estado && (
            <p className="text-sm text-red-500">{errors.estado.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-1">
          <Label htmlFor="renovacionAutomatica">Autorrenovacion</Label>
          <p className="text-sm text-muted-foreground">
            Indica que esta cuenta se paga automaticamente.
          </p>
        </div>
        <Switch
          id="renovacionAutomatica"
          checked={Boolean(renovacionAutomaticaValue)}
          onCheckedChange={(checked) =>
            setValue("renovacionAutomatica", checked)
          }
        />
      </div>

      {estadoValue === "reposo" && (
        <div className="space-y-2">
          <Label htmlFor="diasReposo">Duración del reposo</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {diasReposoValue || "28"} días
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {REPOSO_DAY_OPTIONS.map((days) => (
                <DropdownMenuItem
                  key={days}
                  onClick={() => setValue("diasReposo", days.toString())}
                >
                  {days} días
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notas">Notas adicionales</Label>
        <Textarea
          id="notas"
          {...register("notas")}
          placeholder="Información adicional relevante..."
          rows={6}
        />
      </div>
    </>
  );
}
