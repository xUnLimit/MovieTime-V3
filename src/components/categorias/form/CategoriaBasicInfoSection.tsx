import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
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

import type { CategoriaFormData } from "./categoria-form-helpers";
import {
  getAsociadoLabel,
  getTipoCategoriaLabel,
} from "./categoria-form-helpers";
import { CategoriaGeneralActions } from "./CategoriaFormActions";

interface CategoriaBasicInfoSectionProps {
  errors: FieldErrors<CategoriaFormData>;
  register: UseFormRegister<CategoriaFormData>;
  setValue: UseFormSetValue<CategoriaFormData>;
  tipoCategoriaValue?: string;
  tipoValue?: string;
  onCancel: () => void;
  onNext: () => void;
}

export function CategoriaBasicInfoSection({
  errors,
  register,
  setValue,
  tipoCategoriaValue = "",
  tipoValue = "",
  onCancel,
  onNext,
}: CategoriaBasicInfoSectionProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre</Label>
        <Input
          id="nombre"
          {...register("nombre")}
          placeholder="Ej: Netflix, Disney+"
          onChange={(e) => {
            const v = e.target.value;
            setValue("nombre", v.charAt(0).toUpperCase() + v.slice(1));
          }}
        />
        {errors.nombre && (
          <p className="text-sm text-red-500">{errors.nombre.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Asociado a</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {getAsociadoLabel(tipoValue)}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <DropdownMenuItem onClick={() => setValue("tipo", "cliente")}>
                Cliente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setValue("tipo", "revendedor")}>
                Revendedor
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.tipo && (
            <p className="text-sm text-red-500">{errors.tipo.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Tipo de Categoría</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {getTipoCategoriaLabel(tipoCategoriaValue)}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <DropdownMenuItem
                onClick={() =>
                  setValue("tipoCategoria", "plataforma_streaming")
                }
              >
                Plataforma de Streaming
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setValue("tipoCategoria", "otros")}
              >
                Otros
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.tipoCategoria && (
            <p className="text-sm text-red-500">
              {errors.tipoCategoria.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          {...register("notas")}
          placeholder="Añade notas sobre la categoría..."
          rows={6}
        />
      </div>

      <CategoriaGeneralActions onCancel={onCancel} onNext={onNext} />
    </div>
  );
}
