"use client";

import { VentaCreatePreview } from "@/components/ventas/form/VentaCreatePreview";
import { VentaClientePagoFields } from "@/components/ventas/form/VentaClientePagoFields";
import { VentaFormActions } from "@/components/ventas/form/VentaFormActions";
import { VentaPerfilDetalleDialog } from "@/components/ventas/form/VentaPerfilDetalleDialog";
import { VentaCreateItemSection } from "@/components/ventas/form/create/VentaCreateItemSection";
import { useVentasFormController } from "@/components/ventas/form/create/useVentasFormController";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isPendingTerceroPaymentMethodId,
  PENDING_TERCERO_PAYMENT_ID,
} from "@/lib/utils/terceroMetodoPago";

export function VentasForm() {
  const {
    activeTab,
    setActiveTab,
    isDatosTabComplete,
    router,
    register,
    setValue,
    clearErrors,
    errors,
    categoriaId,
    categorias,
    categoriasOrdenadas,
    tipoPlanId,
    categoriaSeleccionada,
    descuento,
    setDescuento,
    estadoValue,
    fechaFinOpen,
    setFechaFinOpen,
    fechaFinValue,
    fechaInicioOpen,
    setFechaInicioOpen,
    fechaInicioValue,
    itemErrors,
    items,
    loadingServicios,
    loadingVentasRanking,
    notasItem,
    setNotasItem,
    perfilNombre,
    setPerfilNombre,
    perfilNumero,
    perfilesDropdown,
    planId,
    planSeleccionado,
    planesDisponibles,
    precio,
    precioFinalNumero,
    servicioId,
    servicioSeleccionado,
    serviciosRankeados,
    serviciosVentana,
    simboloMoneda,
    subtotal,
    totalFinal,
    clienteSeleccionado,
    tercerosFiltrados,
    searchCliente,
    setSearchCliente,
    metodoPagoIdValue,
    metodoPagoSeleccionado,
    metodosPagoOrdenados,
    notifyCliente,
    setNotifyCliente,
    editedMessage,
    setEditedMessage,
    saving,
    perfilDetalleOpen,
    setPerfilDetalleOpen,
    servicioDetalle,
    perfilesDetalleVisual,
    resumenPerfilesDetalle,
    loadingPerfilesDetalle,
    errorPerfilesDetalle,
    setErrorPerfilesDetalle,
    getDisponiblesColorClass,
    getSlotsDisponibles,
    handleAddItem,
    handleEditItem,
    handleGuardarVenta,
    handleNext,
    handleOpenPerfilDetalle,
    handlePrecioChange,
    handleRemoveItem,
    handleSelectCategoria,
    handleSelectFechaFin,
    handleSelectFechaInicio,
    handleSelectPerfil,
    handleSelectPlan,
    handleSelectServicio,
    handleSelectTipoPlan,
    handleServiciosDropdownWheel,
    handleTabChange,
    scrollServiciosDropdown,
  } = useVentasFormController();
  return (
    <form onSubmit={handleGuardarVenta} className="space-y-6" noValidate>
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
            Informacion de la Venta
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
          <div className="space-y-6">
            <VentaClientePagoFields
              clienteSeleccionado={clienteSeleccionado}
              tercerosFiltrados={tercerosFiltrados}
              searchCliente={searchCliente}
              metodoPagoId={metodoPagoIdValue}
              metodoPagoNombre={metodoPagoSeleccionado?.nombre}
              metodosPago={metodosPagoOrdenados}
              clienteError={errors.clienteId?.message}
              metodoPagoError={errors.metodoPagoId?.message}
              onSearchClienteChange={setSearchCliente}
              onSelectTercero={(usuario) => {
                setValue("clienteId", usuario.id);
                clearErrors("clienteId");
                const nextMetodoPagoId = isPendingTerceroPaymentMethodId(
                  usuario.metodoPagoId,
                )
                  ? PENDING_TERCERO_PAYMENT_ID
                  : usuario.metodoPagoId;
                setValue("metodoPagoId", nextMetodoPagoId);
                clearErrors("metodoPagoId");
                setSearchCliente("");
              }}
              onSelectMetodoPago={(metodoId) => {
                setValue("metodoPagoId", metodoId);
                clearErrors("metodoPagoId");
              }}
            />

            <VentaCreateItemSection
              categoriaId={categoriaId}
              categorias={categorias}
              categoriasOrdenadas={categoriasOrdenadas}
              codigoRegistration={register("codigo")}
              descuento={descuento}
              estadoValue={estadoValue}
              fechaFinOpen={fechaFinOpen}
              fechaFinValue={fechaFinValue}
              fechaInicioOpen={fechaInicioOpen}
              fechaInicioValue={fechaInicioValue}
              getDisponiblesColorClass={getDisponiblesColorClass}
              getSlotsDisponibles={getSlotsDisponibles}
              itemErrors={itemErrors}
              items={items}
              loadingServicios={loadingServicios}
              loadingVentasRanking={loadingVentasRanking}
              notasItem={notasItem}
              onAddItem={handleAddItem}
              onCategoriaSelect={handleSelectCategoria}
              onTipoPlanSelect={handleSelectTipoPlan}
              tipoPlanId={tipoPlanId}
              tiposPlanes={categoriaSeleccionada?.tiposPlanes ?? []}
              onDescuentoChange={setDescuento}
              onEditItem={handleEditItem}
              onEstadoChange={(estado) => setValue("estado", estado)}
              onFechaFinOpenChange={setFechaFinOpen}
              onFechaFinSelect={handleSelectFechaFin}
              onFechaInicioOpenChange={setFechaInicioOpen}
              onFechaInicioSelect={handleSelectFechaInicio}
              onNotasItemChange={setNotasItem}
              onOpenPerfilDetalle={(servicio) => {
                void handleOpenPerfilDetalle(servicio);
              }}
              onPerfilNombreChange={setPerfilNombre}
              onPerfilSelect={handleSelectPerfil}
              onPlanSelect={handleSelectPlan}
              onPrecioChange={handlePrecioChange}
              onRemoveItem={handleRemoveItem}
              onServicioSelect={handleSelectServicio}
              onServiciosScroll={scrollServiciosDropdown}
              onServiciosWheel={handleServiciosDropdownWheel}
              perfilNombre={perfilNombre}
              perfilNumero={perfilNumero}
              perfilesDropdown={perfilesDropdown}
              planId={planId}
              planSeleccionado={planSeleccionado}
              planesDisponibles={planesDisponibles}
              precio={precio}
              precioFinalNumero={precioFinalNumero}
              servicioId={servicioId}
              servicioSeleccionado={servicioSeleccionado}
              serviciosFiltradosTotal={serviciosRankeados.length}
              serviciosVentana={serviciosVentana}
              simboloMoneda={simboloMoneda}
              subtotal={subtotal}
              totalFinal={totalFinal}
            />
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <VentaCreatePreview
            clienteNombre={
              clienteSeleccionado
                ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
                : "Sin seleccionar"
            }
            metodoPagoNombre={
              metodoPagoSeleccionado?.nombre || "Sin seleccionar"
            }
            items={items}
            simboloMoneda={simboloMoneda}
            totalFinal={totalFinal}
            notifyCliente={notifyCliente}
            estado={estadoValue}
            editedMessage={editedMessage}
            onNotifyClienteChange={setNotifyCliente}
            onEditedMessageChange={setEditedMessage}
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
        pendingLabel="Pendiente en esta venta"
      />

      <VentaFormActions
        activeTab={activeTab}
        submitLabel="Guardar venta"
        submitDisabled={saving}
        onPrevious={() => setActiveTab("datos")}
        onCancel={() => router.push("/ventas")}
        onNext={handleNext}
      />
    </form>
  );
}
