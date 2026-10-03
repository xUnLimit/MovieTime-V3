import { getCodeProvider } from "@/modules/code-providers";
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
import type { Categoria } from "@/types";

import type { ServicioFormBindings } from "./types";

interface ServicioDatosBasicosSectionProps extends ServicioFormBindings {
  categoriaNombre: string;
  categoriasActivas: Categoria[];
}

export function ServicioDatosBasicosSection({
  categoriaNombre,
  categoriasActivas,
  errors,
  register,
  setValue,
}: ServicioDatosBasicosSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre del servicio</Label>
        <Input
          id="nombre"
          {...register("nombre")}
          placeholder="Ej: Netflix, Disney+"
          onChange={(event) => {
            const value = event.target.value;
            const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
            setValue("nombre", capitalized);
          }}
        />
        {errors.nombre && (
          <p className="text-sm text-danger">{errors.nombre.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoria">Categoría</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              type="button"
            >
              {categoriaNombre}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)]"
          >
            {categoriasActivas.map((categoria) => (
              <DropdownMenuItem
                key={categoria.id}
                onClick={() => {
                  setValue("categoriaId", categoria.id);
                  setValue("tipoPlan", "");
                  if (!getCodeProvider(categoria.codeProvider)) {
                    setValue("accesoPorCodigo", false, { shouldDirty: true, shouldValidate: true });
                  }
                }}
              >
                {categoria.nombre}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {errors.categoriaId && (
          <p className="text-sm text-danger">{errors.categoriaId.message}</p>
        )}
      </div>
    </div>
  );
}
