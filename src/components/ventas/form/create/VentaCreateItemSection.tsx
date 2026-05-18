import type { KeyboardEvent, WheelEvent } from "react";
import { CalendarIcon, ChevronDown, Plus } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

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
import { VentaItemsCart } from "@/components/ventas/form/VentaItemsCart";
import { VentaServicioSelector } from "@/components/ventas/form/VentaServicioSelector";
import {
  SERVICIOS_DROPDOWN_VISIBLE_ROWS,
  type VentaItem,
  type VentaItemErrors,
} from "@/features/ventas/ventas-form-shared";
import { formatearFecha } from "@/lib/utils/calculations";
import { cn } from "@/lib/utils";
import type { Categoria, Plan, Servicio } from "@/types";
import { es } from "date-fns/locale";

const INPUT_CONTROL_KEYS = [
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
];

function shouldAllowControlKey(event: KeyboardEvent<HTMLInputElement>) {
  return INPUT_CONTROL_KEYS.includes(event.key) || event.ctrlKey || event.metaKey;
}

function handleDecimalKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  const char = event.key;
  const currentValue = event.currentTarget.value;

  if (shouldAllowControlKey(event)) return;
  if (!/[0-9.]/.test(char)) {
    event.preventDefault();
  }
  if (char === "." && currentValue.includes(".")) {
    event.preventDefault();
  }
}

function handleIntegerKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  const char = event.key;

  if (shouldAllowControlKey(event)) return;
  if (!/[0-9]/.test(char)) {
    event.preventDefault();
  }
}

interface VentaCreateItemSectionProps {
  categoriaId: string;
  categorias: Categoria[];
  categoriasOrdenadas: Categoria[];
  codigoRegistration: UseFormRegisterReturn<"codigo">;
  descuento: string;
  estadoValue: "activo" | "inactivo";
  fechaFinOpen: boolean;
  fechaFinValue?: Date;
  fechaInicioOpen: boolean;
  fechaInicioValue?: Date;
  getDisponiblesColorClass: (disponibles: number, total: number) => string;
  getSlotsDisponibles: (servicioId: string) => number;
  itemErrors: VentaItemErrors;
  items: VentaItem[];
  loadingServicios: boolean;
  loadingVentasRanking: boolean;
  notasItem: string;
  onAddItem: () => void;
  onCategoriaSelect: (categoriaId: string) => void;
  onTipoPlanSelect: (tipoPlanId: string) => void;
  tipoPlanId: string;
  tiposPlanes: { id: string; nombre: string }[];
  onDescuentoChange: (value: string) => void;
  onEditItem: (item: VentaItem) => void;
  onEstadoChange: (estado: "activo" | "inactivo") => void;
  onFechaFinOpenChange: (open: boolean) => void;
  onFechaFinSelect: (date?: Date) => void;
  onFechaInicioOpenChange: (open: boolean) => void;
  onFechaInicioSelect: (date?: Date) => void;
  onNotasItemChange: (value: string) => void;
  onOpenPerfilDetalle: (servicio: Servicio) => void;
  onPerfilNombreChange: (value: string) => void;
  onPerfilSelect: (numero: number) => void;
  onPlanSelect: (plan: Plan) => void;
  onPrecioChange: (value: string) => void;
  onRemoveItem: (id: string) => void;
  onServicioSelect: (servicio: Servicio) => void;
  onServiciosScroll: (direction: "up" | "down") => void;
  onServiciosWheel: (event: WheelEvent<HTMLDivElement>) => void;
  perfilNombre: string;
  perfilNumero: string;
  perfilesDropdown: number[];
  planId: string;
  planSeleccionado?: Plan;
  planesDisponibles: Plan[];
  precio: string;
  precioFinalNumero: number;
  servicioId: string;
  servicioSeleccionado?: Servicio;
  serviciosFiltradosTotal: number;
  serviciosVentana: Servicio[];
  simboloMoneda: string;
  subtotal: number;
  totalFinal: number;
}

export function VentaCreateItemSection({
  categoriaId,
  categorias,
  categoriasOrdenadas,
  codigoRegistration,
  descuento,
  estadoValue,
  fechaFinOpen,
  fechaFinValue,
  fechaInicioOpen,
  fechaInicioValue,
  getDisponiblesColorClass,
  getSlotsDisponibles,
  itemErrors,
  items,
  loadingServicios,
  loadingVentasRanking,
  notasItem,
  onAddItem,
  onCategoriaSelect,
  onTipoPlanSelect,
  tipoPlanId,
  tiposPlanes,
  onDescuentoChange,
  onEditItem,
  onEstadoChange,
  onFechaFinOpenChange,
  onFechaFinSelect,
  onFechaInicioOpenChange,
  onFechaInicioSelect,
  onNotasItemChange,
  onOpenPerfilDetalle,
  onPerfilNombreChange,
  onPerfilSelect,
  onPlanSelect,
  onPrecioChange,
  onRemoveItem,
  onServicioSelect,
  onServiciosScroll,
  onServiciosWheel,
  perfilNombre,
  perfilNumero,
  perfilesDropdown,
  planId,
  planSeleccionado,
  planesDisponibles,
  precio,
  precioFinalNumero,
  servicioId,
  servicioSeleccionado,
  serviciosFiltradosTotal,
  serviciosVentana,
  simboloMoneda,
  subtotal,
  totalFinal,
}: VentaCreateItemSectionProps) {
  return (
    <div className="mt-2 border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Agregar items a la venta</h3>
        <span className="text-sm text-muted-foreground">
          {items.length} items
        </span>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${tiposPlanes.length > 1 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
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
                    ? tiposPlanes.find((t) => t.id === tipoPlanId)?.nombre
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
                <DropdownMenuItem
                  key={plan.id}
                  onClick={() => onPlanSelect(plan)}
                >
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <VentaServicioSelector
          categoriaId={categoriaId}
          planId={planId}
          requirePlan
          servicioId={servicioId}
          servicioSeleccionado={servicioSeleccionado}
          servicios={serviciosVentana}
          totalServicios={serviciosFiltradosTotal}
          visibleRows={SERVICIOS_DROPDOWN_VISIBLE_ROWS}
          loading={loadingServicios || loadingVentasRanking}
          error={itemErrors.servicio}
          getSlotsDisponibles={getSlotsDisponibles}
          getDisponiblesColorClass={getDisponiblesColorClass}
          onOpenPerfilDetalle={onOpenPerfilDetalle}
          onScroll={onServiciosScroll}
          onWheel={onServiciosWheel}
          onSelectServicio={onServicioSelect}
        />

        <div className="space-y-2">
          <Label>Perfil</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className="w-full justify-between"
                disabled={!servicioId || getSlotsDisponibles(servicioId) <= 0}
              >
                {perfilNumero
                  ? `Perfil ${perfilNumero}`
                  : getSlotsDisponibles(servicioId) > 0
                    ? "Seleccionar perfil"
                    : "No hay perfiles disponibles"}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)] p-0"
            >
              <div className="p-1">
                {getSlotsDisponibles(servicioId) <= 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    No hay perfiles disponibles.
                  </p>
                ) : perfilesDropdown.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    No hay perfiles libres.
                  </p>
                ) : (
                  perfilesDropdown.map((numero) => (
                    <DropdownMenuItem
                      key={numero}
                      onClick={() => onPerfilSelect(numero)}
                    >
                      Perfil {numero}
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {itemErrors.perfil ? (
            <p className="text-sm text-red-500">{itemErrors.perfil}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
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
            <p className="text-sm text-red-500">{itemErrors.precio}</p>
          ) : null}
        </div>

        <div className="space-y-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
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

        <div className="space-y-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
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

        <div className="space-y-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
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

        <div className="space-y-2">
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

      <div className="space-y-2">
        <Label htmlFor="venta-create-notas">Notas</Label>
        <Textarea
          id="venta-create-notas"
          name="notasItem"
          rows={3}
          value={notasItem}
          onChange={(event) => onNotasItemChange(event.target.value)}
          placeholder="Notas adicionales"
        />
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={onAddItem}
      >
        <Plus className="h-4 w-4 mr-2" />
        Agregar al carrito
      </Button>

      <VentaItemsCart
        items={items}
        categorias={categorias}
        simboloMoneda={simboloMoneda}
        subtotal={subtotal}
        totalFinal={totalFinal}
        onEditItem={onEditItem}
        onRemoveItem={onRemoveItem}
      />
    </div>
  );
}
