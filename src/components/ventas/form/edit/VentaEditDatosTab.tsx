import { useState, type KeyboardEvent, type WheelEvent } from "react";
import { es } from "date-fns/locale";
import { CalendarIcon, ChevronDown } from "lucide-react";
import type {
  FieldErrors,
  UseFormClearErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

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
import type { VentaEditFormData } from "@/features/ventas/venta-edit-form-schema";
import { MESES_POR_CICLO } from "@/features/ventas/ventas-form-shared";
import { formatearFecha } from "@/lib/utils/calculations";
import { cn } from "@/lib/utils";
import {
  isPendingTerceroPaymentMethodId,
  PENDING_TERCERO_PAYMENT_ID,
} from "@/lib/utils/terceroMetodoPago";
import { VentaClientePagoFields } from "@/components/ventas/form/VentaClientePagoFields";
import { VentaServicioSelector } from "@/components/ventas/form/VentaServicioSelector";
import type { Categoria, MetodoPago, Plan, Servicio, Tercero } from "@/types";

const CODIGO_CONTROL_KEYS = [
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
  return CODIGO_CONTROL_KEYS.includes(event.key) || event.ctrlKey || event.metaKey;
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

function handleCodigoKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  const char = event.key;
  if (shouldAllowControlKey(event)) return;
  if (!/[0-9]/.test(char)) {
    event.preventDefault();
  }
}

interface VentaEditDatosTabProps {
  register: UseFormRegister<VentaEditFormData>;
  setValue: UseFormSetValue<VentaEditFormData>;
  clearErrors: UseFormClearErrors<VentaEditFormData>;
  errors: FieldErrors<VentaEditFormData>;
  clienteSeleccionado?: Tercero;
  tercerosFiltrados: Tercero[];
  searchCliente: string;
  metodoPagoIdValue: string;
  metodoPagoNombre?: string;
  metodosPagoOrdenados: MetodoPago[];
  onSearchClienteChange: (value: string) => void;
  categoriaIdValue: string;
  categoriaSeleccionada?: Categoria;
  categoriasOrdenadas: Categoria[];
  tipoPlanId: string;
  tiposPlanes: { id: string; nombre: string }[];
  onTipoPlanSelect: (tipoPlanId: string) => void;
  servicioIdValue: string;
  servicioSeleccionado?: Servicio;
  serviciosVentana: Servicio[];
  totalServicios: number;
  visibleServiciosRows: number;
  loadingServicios: boolean;
  getSlotsDisponibles: (servicioId: string) => number;
  getDisponiblesColorClass: (disponibles: number, total: number) => string;
  onOpenPerfilDetalle: (servicio: Servicio) => Promise<void> | void;
  onScrollServicios: (direction: "up" | "down") => void;
  onWheelServicios: (event: WheelEvent<HTMLDivElement>) => void;
  planSeleccionado?: Plan;
  planesDisponibles: Plan[];
  planIdValue: string;
  perfilNumeroValue?: string;
  perfilesDropdown: number[];
  fechaInicioValue?: Date;
  fechaFinValue?: Date;
  simboloMoneda: string;
  precioFinal: number;
  estadoValue: VentaEditFormData["estado"];
}

export function VentaEditDatosTab({
  register,
  setValue,
  clearErrors,
  errors,
  clienteSeleccionado,
  tercerosFiltrados,
  searchCliente,
  metodoPagoIdValue,
  metodoPagoNombre,
  metodosPagoOrdenados,
  onSearchClienteChange,
  categoriaIdValue,
  categoriaSeleccionada,
  categoriasOrdenadas,
  tipoPlanId,
  tiposPlanes,
  onTipoPlanSelect,
  servicioIdValue,
  servicioSeleccionado,
  serviciosVentana,
  totalServicios,
  visibleServiciosRows,
  loadingServicios,
  getSlotsDisponibles,
  getDisponiblesColorClass,
  onOpenPerfilDetalle,
  onScrollServicios,
  onWheelServicios,
  planSeleccionado,
  planesDisponibles,
  planIdValue,
  perfilNumeroValue,
  perfilesDropdown,
  fechaInicioValue,
  fechaFinValue,
  simboloMoneda,
  precioFinal,
  estadoValue,
}: VentaEditDatosTabProps) {
  const [fechaInicioOpen, setFechaInicioOpen] = useState(false);
  const [fechaFinOpen, setFechaFinOpen] = useState(false);

  return (
    <>
      <VentaClientePagoFields
        clienteSeleccionado={clienteSeleccionado}
        tercerosFiltrados={tercerosFiltrados}
        searchCliente={searchCliente}
        metodoPagoId={metodoPagoIdValue}
        metodoPagoNombre={metodoPagoNombre}
        metodosPago={metodosPagoOrdenados}
        clienteError={errors.clienteId?.message}
        metodoPagoError={errors.metodoPagoId?.message}
        onSearchClienteChange={onSearchClienteChange}
        onSelectTercero={(usuario) => {
          setValue("clienteId", usuario.id);
          setValue(
            "metodoPagoId",
            isPendingTerceroPaymentMethodId(usuario.metodoPagoId)
              ? PENDING_TERCERO_PAYMENT_ID
              : usuario.metodoPagoId,
          );
          clearErrors("clienteId");
          clearErrors("metodoPagoId");
          onSearchClienteChange("");
        }}
        onSelectMetodoPago={(metodoId) => {
          setValue("metodoPagoId", metodoId);
          clearErrors("metodoPagoId");
        }}
      />

      <div className={`grid grid-cols-1 gap-6 ${tiposPlanes.length > 1 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <div className="space-y-2">
          <Label>Categoría</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className="w-full justify-between"
              >
                {categoriaSeleccionada
                  ? categoriaSeleccionada.nombre
                  : "Seleccionar categoría"}
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
                  onClick={() => {
                    setValue("categoriaId", categoria.id);
                    onTipoPlanSelect("");
                    setValue("servicioId", "");
                    setValue("planId", "");
                    setValue("perfilNumero", "");
                    setValue("perfilNombre", "");
                    clearErrors("categoriaId");
                  }}
                >
                  {categoria.nombre}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.categoriaId && (
            <p className="text-sm text-red-500">
              {errors.categoriaId.message}
            </p>
          )}
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
                  disabled={!categoriaIdValue}
                >
                  {tipoPlanId
                    ? tiposPlanes.find((tipo) => tipo.id === tipoPlanId)?.nombre
                    : categoriaIdValue
                      ? "Seleccionar tipo"
                      : "Primero selecciona categoría"}
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
                    onClick={() => {
                      onTipoPlanSelect(tipo.id);
                      setValue("servicioId", "");
                      setValue("planId", "");
                      setValue("perfilNumero", "");
                      setValue("perfilNombre", "");
                      clearErrors("servicioId");
                      clearErrors("planId");
                      clearErrors("perfilNumero");
                    }}
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
                disabled={!categoriaIdValue || (tiposPlanes.length > 1 && !tipoPlanId)}
              >
                {planSeleccionado
                  ? planSeleccionado.nombre
                  : tiposPlanes.length > 1 && !tipoPlanId
                    ? "Primero selecciona tipo"
                    : categoriaIdValue
                      ? "Seleccionar plan"
                      : "Primero selecciona categoría"}
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
                  onClick={() => {
                    setValue("planId", plan.id);
                    setValue("servicioId", "");
                    setValue("perfilNumero", "");
                    setValue("perfilNombre", "");
                    if (fechaInicioValue) {
                      const meses = MESES_POR_CICLO[plan.cicloPago] ?? 1;
                      const fechaFin = new Date(fechaInicioValue);
                      fechaFin.setMonth(fechaFin.getMonth() + meses);
                      setValue("fechaFin", fechaFin);
                    }
                    clearErrors("planId");
                    clearErrors("servicioId");
                    clearErrors("perfilNumero");
                  }}
                >
                  {plan.nombre}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.planId && (
            <p className="text-sm text-red-500">{errors.planId.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <VentaServicioSelector
          categoriaId={categoriaIdValue}
          planId={planIdValue}
          requirePlan
          servicioId={servicioIdValue}
          servicioSeleccionado={servicioSeleccionado}
          servicios={serviciosVentana}
          totalServicios={totalServicios}
          visibleRows={visibleServiciosRows}
          loading={loadingServicios}
          error={errors.servicioId?.message}
          getSlotsDisponibles={getSlotsDisponibles}
          getDisponiblesColorClass={getDisponiblesColorClass}
          onOpenPerfilDetalle={(servicio) => {
            void onOpenPerfilDetalle(servicio);
          }}
          onScroll={onScrollServicios}
          onWheel={onWheelServicios}
          onSelectServicio={(servicio) => {
            setValue("servicioId", servicio.id);
            setValue("perfilNumero", "");
            setValue("perfilNombre", "");
            clearErrors("servicioId");
            clearErrors("perfilNumero");
          }}
        />

        <div className="space-y-2">
          <Label>Perfil</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                type="button"
                className="w-full justify-between"
                disabled={
                  !servicioIdValue || getSlotsDisponibles(servicioIdValue) <= 0
                }
              >
                {perfilNumeroValue
                  ? `Perfil ${perfilNumeroValue}`
                  : getSlotsDisponibles(servicioIdValue) > 0
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
                {getSlotsDisponibles(servicioIdValue) <= 0 ? (
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
                      onClick={() => {
                        setValue("perfilNumero", String(numero));
                        clearErrors("perfilNumero");
                      }}
                    >
                      Perfil {numero}
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {errors.perfilNumero && (
            <p className="text-sm text-red-500">
              {errors.perfilNumero.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="venta-edit-precio">Precio</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
              {simboloMoneda}
            </span>
            <Input
              id="venta-edit-precio"
              type="text"
              inputMode="decimal"
              className="pl-10"
              {...register("precio")}
              onChange={(event) =>
                setValue("precio", event.target.value.replace(",", "."))
              }
              onKeyDown={handleDecimalKeyDown}
            />
          </div>
          {errors.precio && (
            <p className="text-sm text-red-500">{errors.precio.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="venta-edit-descuento">Descuento %</Label>
          <Input
            id="venta-edit-descuento"
            type="text"
            inputMode="decimal"
            {...register("descuento")}
            onChange={(event) =>
              setValue("descuento", event.target.value.replace(",", "."))
            }
            onKeyDown={handleDecimalKeyDown}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Fecha de inicio</Label>
          <Popover open={fechaInicioOpen} onOpenChange={setFechaInicioOpen}>
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
                onSelect={(date) => {
                  const nextDate = date || new Date();
                  setValue("fechaInicio", nextDate);
                  clearErrors("fechaInicio");
                  if (planSeleccionado) {
                    const meses = MESES_POR_CICLO[planSeleccionado.cicloPago] ?? 1;
                    const fechaFin = new Date(nextDate);
                    fechaFin.setMonth(fechaFin.getMonth() + meses);
                    setValue("fechaFin", fechaFin);
                  }
                }}
                defaultMonth={fechaInicioValue ?? new Date()}
                locale={es}
              />
            </PopoverContent>
          </Popover>
          {errors.fechaInicio && (
            <p className="text-sm text-red-500">
              {errors.fechaInicio.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Fecha de fin</Label>
          <Popover open={fechaFinOpen} onOpenChange={setFechaFinOpen}>
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
                onSelect={(date) => {
                  setValue("fechaFin", date || new Date());
                  clearErrors("fechaFin");
                }}
                defaultMonth={fechaFinValue ?? new Date()}
                locale={es}
              />
            </PopoverContent>
          </Popover>
          {errors.fechaFin && (
            <p className="text-sm text-red-500">{errors.fechaFin.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="venta-edit-perfil-nombre">Nombre del Perfil</Label>
          <Input
            id="venta-edit-perfil-nombre"
            type="text"
            {...register("perfilNombre")}
            placeholder="Ej: Perfil Kids"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="venta-edit-codigo">Codigo</Label>
          <Input
            id="venta-edit-codigo"
            type="text"
            inputMode="numeric"
            {...register("codigo")}
            onKeyDown={handleCodigoKeyDown}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="venta-edit-precio-final">Precio final</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none select-none">
              {simboloMoneda}
            </span>
            <Input
              id="venta-edit-precio-final"
              name="precioFinalCalculado"
              type="text"
              value={precioFinal.toFixed(2)}
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
              <DropdownMenuItem onClick={() => setValue("estado", "activo")}>
                Activo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setValue("estado", "inactivo")}>
                Inactivo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="venta-edit-notas">Notas</Label>
        <Textarea
          id="venta-edit-notas"
          rows={4}
          {...register("notas")}
          placeholder="Notas adicionales"
        />
      </div>
    </>
  );
}
