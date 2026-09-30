import type { WheelEvent } from "react";
import { Plus } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { VentaItemsCart } from "@/components/ventas/form/VentaItemsCart";
import { VentaCreatePaymentDetailsFields } from "@/components/ventas/form/create/VentaCreatePaymentDetailsFields";
import { VentaCreatePlanFields } from "@/components/ventas/form/create/VentaCreatePlanFields";
import { VentaCreateServiceProfileFields } from "@/components/ventas/form/create/VentaCreateServiceProfileFields";
import type {
  VentaItem,
  VentaItemErrors,
} from "@/components/ventas/form/ventas-form-shared";
import type { Categoria, Plan, Servicio } from "@/types";

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
    <div className="flex flex-1 flex-col justify-between gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Agregar items a la venta</h3>
        <span className="text-sm text-muted-foreground">
          {items.length} items
        </span>
      </div>

      <VentaCreatePlanFields
        categoriaId={categoriaId}
        categorias={categorias}
        categoriasOrdenadas={categoriasOrdenadas}
        itemErrors={itemErrors}
        onCategoriaSelect={onCategoriaSelect}
        onPlanSelect={onPlanSelect}
        onTipoPlanSelect={onTipoPlanSelect}
        planId={planId}
        planSeleccionado={planSeleccionado}
        planesDisponibles={planesDisponibles}
        tipoPlanId={tipoPlanId}
        tiposPlanes={tiposPlanes}
      />

      <VentaCreateServiceProfileFields
        categoriaId={categoriaId}
        getDisponiblesColorClass={getDisponiblesColorClass}
        getSlotsDisponibles={getSlotsDisponibles}
        itemErrors={itemErrors}
        loadingServicios={loadingServicios}
        loadingVentasRanking={loadingVentasRanking}
        onOpenPerfilDetalle={onOpenPerfilDetalle}
        onPerfilSelect={onPerfilSelect}
        onServicioSelect={onServicioSelect}
        onServiciosScroll={onServiciosScroll}
        onServiciosWheel={onServiciosWheel}
        perfilNumero={perfilNumero}
        perfilesDropdown={perfilesDropdown}
        planId={planId}
        servicioId={servicioId}
        servicioSeleccionado={servicioSeleccionado}
        serviciosFiltradosTotal={serviciosFiltradosTotal}
        serviciosVentana={serviciosVentana}
      />
      <VentaCreatePaymentDetailsFields
        codigoRegistration={codigoRegistration}
        descuento={descuento}
        estadoValue={estadoValue}
        fechaFinOpen={fechaFinOpen}
        fechaFinValue={fechaFinValue}
        fechaInicioOpen={fechaInicioOpen}
        fechaInicioValue={fechaInicioValue}
        itemErrors={itemErrors}
        notasItem={notasItem}
        onDescuentoChange={onDescuentoChange}
        onEstadoChange={onEstadoChange}
        onFechaFinOpenChange={onFechaFinOpenChange}
        onFechaFinSelect={onFechaFinSelect}
        onFechaInicioOpenChange={onFechaInicioOpenChange}
        onFechaInicioSelect={onFechaInicioSelect}
        onNotasItemChange={onNotasItemChange}
        onPerfilNombreChange={onPerfilNombreChange}
        onPrecioChange={onPrecioChange}
        perfilNombre={perfilNombre}
        precio={precio}
        precioFinalNumero={precioFinalNumero}
        simboloMoneda={simboloMoneda}
      />
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
