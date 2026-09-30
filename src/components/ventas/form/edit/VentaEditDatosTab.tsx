import type { WheelEvent } from "react";
import type {
  FieldErrors,
  UseFormClearErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

import type { VentaEditFormData } from "@/components/ventas/form/venta-edit-form-schema";
import {
  isPendingTerceroPaymentMethodId,
  PENDING_TERCERO_PAYMENT_ID,
} from "@/platform/utils/terceroMetodoPago";
import { VentaClientePagoFields } from "@/components/ventas/form/VentaClientePagoFields";
import { VentaEditPaymentDetailsFields } from "@/components/ventas/form/edit/VentaEditPaymentDetailsFields";
import { VentaEditPlanFields } from "@/components/ventas/form/edit/VentaEditPlanFields";
import { VentaEditServiceProfileFields } from "@/components/ventas/form/edit/VentaEditServiceProfileFields";
import type { Categoria, MetodoPago, Plan, Servicio, Tercero } from "@/types";

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

      <VentaEditPlanFields
        categoriaIdValue={categoriaIdValue}
        categoriaSeleccionada={categoriaSeleccionada}
        categoriasOrdenadas={categoriasOrdenadas}
        clearErrors={clearErrors}
        errors={errors}
        fechaInicioValue={fechaInicioValue}
        onTipoPlanSelect={onTipoPlanSelect}
        planSeleccionado={planSeleccionado}
        planesDisponibles={planesDisponibles}
        setValue={setValue}
        tipoPlanId={tipoPlanId}
        tiposPlanes={tiposPlanes}
      />
      <VentaEditServiceProfileFields
        categoriaIdValue={categoriaIdValue}
        clearErrors={clearErrors}
        errors={errors}
        getDisponiblesColorClass={getDisponiblesColorClass}
        getSlotsDisponibles={getSlotsDisponibles}
        loadingServicios={loadingServicios}
        onOpenPerfilDetalle={onOpenPerfilDetalle}
        onScrollServicios={onScrollServicios}
        onWheelServicios={onWheelServicios}
        perfilNumeroValue={perfilNumeroValue}
        perfilesDropdown={perfilesDropdown}
        planIdValue={planIdValue}
        servicioIdValue={servicioIdValue}
        servicioSeleccionado={servicioSeleccionado}
        serviciosVentana={serviciosVentana}
        setValue={setValue}
        totalServicios={totalServicios}
        visibleServiciosRows={visibleServiciosRows}
      />
      <VentaEditPaymentDetailsFields
        clearErrors={clearErrors}
        errors={errors}
        estadoValue={estadoValue}
        fechaFinValue={fechaFinValue}
        fechaInicioValue={fechaInicioValue}
        planSeleccionado={planSeleccionado}
        precioFinal={precioFinal}
        register={register}
        setValue={setValue}
        simboloMoneda={simboloMoneda}
      />    </>
  );
}
