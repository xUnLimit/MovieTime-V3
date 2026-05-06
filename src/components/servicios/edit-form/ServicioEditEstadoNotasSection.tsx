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
import { Textarea } from "@/components/ui/textarea";

import type { ServicioEditFormData } from "./schema";
import { getEstadoLabel, handleIntegerInputKeyDown } from "./helpers";
import type { ServicioEditFormBindings } from "./types";

interface ServicioEditEstadoNotasSectionProps
  extends ServicioEditFormBindings {
  estadoValue: ServicioEditFormData["estado"];
}

export function ServicioEditEstadoNotasSection({
  errors,
  estadoValue,
  register,
  setValue,
}: ServicioEditEstadoNotasSectionProps) {
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
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.estado && (
            <p className="text-sm text-red-500">{errors.estado.message}</p>
          )}
        </div>
      </div>

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
