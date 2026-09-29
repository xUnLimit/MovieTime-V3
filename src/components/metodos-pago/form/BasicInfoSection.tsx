import type { Dispatch, SetStateAction } from "react";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MetodoPagoFormData } from "./schema";
import {
  ASOCIADO_A_OPTIONS,
  MONEDAS,
  PAISES_MONEDAS,
  getAsociadoALabel,
} from "./options";
import { BasicFormActions } from "./FormActions";
import { capitalizeFirstChar } from "./helpers";

interface BasicInfoSectionProps {
  register: UseFormRegister<MetodoPagoFormData>;
  errors: FieldErrors<MetodoPagoFormData>;
  setValue: UseFormSetValue<MetodoPagoFormData>;
  asociadoAValue: MetodoPagoFormData["asociadoA"] | undefined;
  paisValue: string | undefined;
  monedaValue: string | undefined;
  paisSearch: string;
  setPaisSearch: Dispatch<SetStateAction<string>>;
  onCancel: () => void;
  onNext: () => void;
}

export function BasicInfoSection({
  register,
  errors,
  setValue,
  asociadoAValue,
  paisValue,
  monedaValue,
  paisSearch,
  setPaisSearch,
  onCancel,
  onNext,
}: BasicInfoSectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre del Método</Label>
          <Input
            id="nombre"
            {...register("nombre")}
            placeholder="Ingrese el nombre del método"
            onChange={(e) => {
              setValue("nombre", capitalizeFirstChar(e.target.value));
            }}
          />
          {errors.nombre && (
            <p className="text-sm text-danger">{errors.nombre.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="asociadoA">Asociado a</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {getAsociadoALabel(asociadoAValue)}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {ASOCIADO_A_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setValue("asociadoA", option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.asociadoA && (
            <p className="text-sm text-danger">{errors.asociadoA.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pais">País</Label>
          <DropdownMenu
            onOpenChange={(open) => {
              if (!open) {
                setTimeout(() => setPaisSearch(""), 200);
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {paisValue || "Seleccionar país"}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <div
                className="p-2 border-b"
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar país..."
                    value={paisSearch}
                    onChange={(e) => setPaisSearch(e.target.value)}
                    className="h-8 pl-8"
                    autoFocus
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {PAISES_MONEDAS.filter((pm) =>
                  pm.pais.toLowerCase().includes(paisSearch.toLowerCase()),
                ).map((pm) => (
                  <DropdownMenuItem
                    key={pm.pais}
                    onClick={() => {
                      setValue("pais", pm.pais);
                    }}
                  >
                    {pm.pais}
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.pais && (
            <p className="text-sm text-danger">{errors.pais.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="moneda">Moneda</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                type="button"
              >
                {monedaValue || "Seleccionar moneda"}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {MONEDAS.map((moneda) => (
                <DropdownMenuItem
                  key={moneda}
                  onClick={() => setValue("moneda", moneda)}
                >
                  {moneda}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.moneda && (
            <p className="text-sm text-danger">{errors.moneda.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="alias">Alias</Label>
        <Input
          id="alias"
          {...register("alias")}
          placeholder="Ingrese un alias para identificar este método de pago"
        />
      </div>

      <BasicFormActions onCancel={onCancel} onNext={onNext} />
    </>
  );
}
