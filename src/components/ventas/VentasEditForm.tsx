"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VentaEditPreview } from "@/components/ventas/form/VentaEditPreview";
import { VentaFormActions } from "@/components/ventas/form/VentaFormActions";
import { VentaPerfilDetalleDialog } from "@/components/ventas/form/VentaPerfilDetalleDialog";
import { VentaEditDatosTab } from "@/components/ventas/form/edit/VentaEditDatosTab";
import {
  useVentasEditFormController,
  type VentaEditData,
} from "@/components/ventas/form/edit/useVentasEditFormController";
import { getCicloPagoLabel } from "@/features/ventas/ventas-form-shared";
import { getTerceroMetodoPagoNombre } from "@/lib/utils/terceroMetodoPago";

export type { VentaEditData };

interface VentasEditFormProps {
  venta: VentaEditData;
}

export function VentasEditForm({ venta }: VentasEditFormProps) {
  const {
    activeTab,
    setActiveTab,
    isDatosTabComplete,
    router,
    register,
    handleSubmit,
    setValue,
    clearErrors,
    errors,
    isSubmitting,
    tercerosFiltrados,
    searchCliente,
    setSearchCliente,
    clienteSeleccionado,
    metodoPagoIdValue,
    metodoPagoSeleccionado,
    metodosPagoOrdenados,
    categoriaIdValue,
    categoriaSeleccionada,
    categoriasOrdenadas,
    tipoPlanId,
    setTipoPlanId,
    servicioIdValue,
    servicioSeleccionado,
    serviciosVentana,
    serviciosOrdenados,
    visibleServiciosRows,
    loadingServicios,
    loadingVentasRanking,
    getSlotsDisponibles,
    getDisponiblesColorClass,
    handleOpenPerfilDetalle,
    scrollServiciosDropdown,
    handleServiciosDropdownWheel,
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
    precioBase,
    descuentoNumero,
    perfilNombreValue,
    codigoValue,
    notasValue,
    perfilDetalleOpen,
    setPerfilDetalleOpen,
    servicioDetalle,
    resumenPerfilesDetalle,
    perfilesDetalleVisual,
    loadingPerfilesDetalle,
    errorPerfilesDetalle,
    setErrorPerfilesDetalle,
    hasChanges,
    handleNext,
    handleTabChange,
    onSubmit,
  } = useVentasEditFormController(venta);
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="mb-8 bg-transparent rounded-none p-0 h-auto inline-flex border-b border-border">
          <TabsTrigger
            value="datos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            InformaciÃ³n de la venta
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className={`rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm ${
              !isDatosTabComplete ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            Vista previa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-6">
          <VentaEditDatosTab
            register={register}
            setValue={setValue}
            clearErrors={clearErrors}
            errors={errors}
            clienteSeleccionado={clienteSeleccionado}
            tercerosFiltrados={tercerosFiltrados}
            searchCliente={searchCliente}
            metodoPagoIdValue={metodoPagoIdValue}
            metodoPagoNombre={metodoPagoSeleccionado?.nombre}
            metodosPagoOrdenados={metodosPagoOrdenados}
            onSearchClienteChange={setSearchCliente}
            categoriaIdValue={categoriaIdValue}
            categoriaSeleccionada={categoriaSeleccionada}
            categoriasOrdenadas={categoriasOrdenadas}
            tipoPlanId={tipoPlanId}
            tiposPlanes={categoriaSeleccionada?.tiposPlanes ?? []}
            onTipoPlanSelect={setTipoPlanId}
            servicioIdValue={servicioIdValue}
            servicioSeleccionado={servicioSeleccionado}
            serviciosVentana={serviciosVentana}
            totalServicios={serviciosOrdenados.length}
            visibleServiciosRows={visibleServiciosRows}
            loadingServicios={loadingServicios || loadingVentasRanking}
            getSlotsDisponibles={getSlotsDisponibles}
            getDisponiblesColorClass={getDisponiblesColorClass}
            onOpenPerfilDetalle={handleOpenPerfilDetalle}
            onScrollServicios={scrollServiciosDropdown}
            onWheelServicios={handleServiciosDropdownWheel}
            planSeleccionado={planSeleccionado}
            planesDisponibles={planesDisponibles}
            planIdValue={planIdValue}
            perfilNumeroValue={perfilNumeroValue}
            perfilesDropdown={perfilesDropdown}
            fechaInicioValue={fechaInicioValue}
            fechaFinValue={fechaFinValue}
            simboloMoneda={simboloMoneda}
            precioFinal={precioFinal}
            estadoValue={estadoValue}
          />
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <VentaEditPreview
            clienteNombre={
              clienteSeleccionado
                ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
                : venta.clienteNombre
            }
            metodoPagoNombre={getTerceroMetodoPagoNombre(
              metodoPagoIdValue,
              metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
            )}
            servicioNombre={
              servicioSeleccionado?.nombre || venta.servicioNombre
            }
            cicloLabel={getCicloPagoLabel(
              planSeleccionado?.cicloPago || venta.cicloPago,
            )}
            simboloMoneda={simboloMoneda}
            precioFinal={precioFinal}
            fechaInicio={fechaInicioValue}
            fechaFin={fechaFinValue}
            precioBase={precioBase}
            descuento={descuentoNumero}
            perfilNombre={perfilNombreValue}
            codigo={codigoValue}
            notas={notasValue}
          />
        </TabsContent>
      </Tabs>

      <VentaPerfilDetalleDialog
        open={perfilDetalleOpen}
        onOpenChange={(open) => {
          setPerfilDetalleOpen(open);
          if (!open) {
            setErrorPerfilesDetalle(null);
          }
        }}
        servicio={servicioDetalle}
        resumen={resumenPerfilesDetalle}
        perfiles={perfilesDetalleVisual}
        loading={loadingPerfilesDetalle}
        error={errorPerfilesDetalle}
        pendingLabel="Pendiente en esta edicion"
      />

      <VentaFormActions
        activeTab={activeTab}
        submitLabel="Guardar cambios"
        submitDisabled={isSubmitting || !hasChanges}
        onPrevious={() => setActiveTab("datos")}
        onCancel={() => router.push(`/ventas/${venta.id}`)}
        onNext={handleNext}
      />
    </form>
  );
}