import { CalendarIcon, ChevronDown } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { es } from "date-fns/locale";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { handleDecimalKeyDown, handleIntegerKeyDown } from "@/components/ventas/form/input-key-handlers";
import type { VentaItemErrors } from "@/features/ventas/ventas-form-shared";
import { cn } from "@/platform/utils";
import { formatearFecha } from "@/platform/utils/calculations";

interface VentaCreatePaymentDetailsFieldsProps {
  codigoRegistration: UseFormRegisterReturn<"codigo">;
  descuento: string;
  estadoValue: "activo" | "inactivo";
  fechaFinOpen: boolean;
  fechaFinValue?: Date;
  fechaInicioOpen: boolean;
  fechaInicioValue?: Date;
  itemErrors: VentaItemErrors;
  notasItem: string;
  onDescuentoChange: (value: string) => void;
  onEstadoChange: (estado: "activo" | "inactivo") => void;
  onFechaFinOpenChange: (open: boolean) => void;
  onFechaFinSelect: (date?: Date) => void;
  onFechaInicioOpenChange: (open: boolean) => void;
  onFechaInicioSelect: (date?: Date) => void;
  onNotasItemChange: (value: string) => void;
  onPerfilNombreChange: (value: string) => void;
  onPrecioChange: (value: string) => void;
  perfilNombre: string;
  precio: string;
  precioFinalNumero: number;
  simboloMoneda: string;
}

export function VentaCreatePaymentDetailsFields({
  codigoRegistration,
  descuento,
  estadoValue,
  fechaFinOpen,
  fechaFinValue,
  fechaInicioOpen,
  fechaInicioValue,
  itemErrors,
  notasItem,
  onDescuentoChange,
  onEstadoChange,
  onFechaFinOpenChange,
  onFechaFinSelect,
  onFechaInicioOpenChange,
  onFechaInicioSelect,
  onNotasItemChange,
  onPerfilNombreChange,
  onPrecioChange,
  perfilNombre,
  precio,
  precioFinalNumero,
  simboloMoneda,
}: VentaCreatePaymentDetailsFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="venta-create-precio">Precio</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
              {simboloMoneda}
            </span>
            <Input
              id="venta-create-precio"
              name="precio"
              type="text"
              inputMode="decimal"
              value={precio}
              onChange={(event) =>
                onPrecioChange(event.target.value.replace(",", "."))
              }
              className="pl-10"
              onKeyDown={handleDecimalKeyDown}
            />
          </div>
          {itemErrors.precio ? (
            <p className="text-sm text-danger">{itemErrors.precio}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="venta-create-descuento">Descuento %</Label>
          <Input
            id="venta-create-descuento"
            name="descuento"
            type="text"
            inputMode="decimal"
            value={descuento}
            onChange={(event) =>
              onDescuentoChange(event.target.value.replace(",", "."))
            }
            onKeyDown={handleDecimalKeyDown}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Fecha de Inicio</Label>
          <Popover open={fechaInicioOpen} onOpenChange={onFechaInicioOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !fechaInicioValue && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fechaInicioValue
                  ? formatearFecha(fechaInicioValue)
                  : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fechaInicioValue}
                onSelect={onFechaInicioSelect}
                defaultMonth={fechaInicioValue ?? new Date()}
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label>Fecha de Fin</Label>
          <Popover open={fechaFinOpen} onOpenChange={onFechaFinOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !fechaFinValue && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fechaFinValue
                  ? formatearFecha(fechaFinValue)
                  : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fechaFinValue}
                onSelect={onFechaFinSelect}
                defaultMonth={fechaFinValue ?? new Date()}
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="venta-create-perfil-nombre">Nombre del Perfil</Label>
          <Input
            id="venta-create-perfil-nombre"
            name="perfilNombre"
            type="text"
            value={perfilNombre}
            onChange={(event) => onPerfilNombreChange(event.target.value)}
            placeholder="Ej: Perfil Kids"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="venta-create-codigo">Codigo</Label>
          <Input
            id="venta-create-codigo"
            type="text"
            inputMode="numeric"
            {...codigoRegistration}
            onKeyDown={handleIntegerKeyDown}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="venta-create-precio-final">Precio Final</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
              {simboloMoneda}
            </span>
            <Input
              id="venta-create-precio-final"
              name="precioFinalCalculado"
              type="text"
              value={precioFinalNumero.toFixed(2)}
              readOnly
              tabIndex={-1}
              className="pl-10 pointer-events-none bg-muted/40"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Estado</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className="w-full justify-between"
              >
                {estadoValue === "inactivo" ? "Inactivo" : "Activo"}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <DropdownMenuItem onClick={() => onEstadoChange("activo")}>
                Activo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEstadoChange("inactivo")}>
                Inactivo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="venta-create-notas">Notas</Label>
        <Textarea
          id="venta-create-notas"
          name="notasItem"
          rows={2}
          value={notasItem}
          onChange={(event) => onNotasItemChange(event.target.value)}
          placeholder="Notas adicionales"
        />
      </div>
    </>
  );
}
