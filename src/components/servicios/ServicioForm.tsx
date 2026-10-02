"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Servicio } from "@/types";

import { ServicioDatosTab } from "./form/ServicioDatosTab";
import { ServicioPreviewTab } from "./form/ServicioPreviewTab";
import { useServicioFormController } from "./form/useServicioFormController";

interface ServicioFormProps {
  servicio?: Servicio;
  returnTo?: string;
}

export function ServicioForm({
  servicio,
  returnTo = "/servicios",
}: ServicioFormProps) {
  const {
    accesoPorCodigoValue,
    codeProviderKey,
    activeTab,
    isDatosTabComplete,
    handleSubmit,
    onSubmit,
    handleTabChange,
    categoriaNombre,
    categoriasActivas,
    cicloPagoValue,
    diasReposoValue,
    errors,
    estadoValue,
    fechaInicioValue,
    fechaVencimientoValue,
    metodoPagoDisplayName,
    metodosPagoActivos,
    onCancel,
    handleCicloPagoChange,
    handleFechaVencimientoSelect,
    handleNext,
    openFechaInicio,
    openFechaVencimiento,
    register,
    renovacionAutomaticaValue,
    setOpenFechaInicio,
    setOpenFechaVencimiento,
    setValue,
    simboloMoneda,
    tipoPlanValue,
    tiposPlanesDinamicos,
    contrasenaValue,
    correoValue,
    costoServicioValue,
    hasChanges,
    isEditMode,
    isSubmitting,
    nombreValue,
    handlePrevious,
    perfilesDisponiblesValue,
  } = useServicioFormController({ servicio, returnTo });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-3" noValidate>
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full flex-1"
      >
        <TabsList>
          <TabsTrigger
            value="datos"
          >
            Datos del Servicio
          </TabsTrigger>
          <TabsTrigger
            value="perfil"
            className={!isDatosTabComplete ? "cursor-not-allowed opacity-50" : undefined}
          >
            Vista previa de perfiles
          </TabsTrigger>
        </TabsList>

        <ServicioDatosTab
          accesoPorCodigoValue={accesoPorCodigoValue}
          codeProviderKey={codeProviderKey}
          categoriaNombre={categoriaNombre}
          categoriasActivas={categoriasActivas}
          cicloPagoValue={cicloPagoValue}
          diasReposoValue={diasReposoValue}
          errors={errors}
          estadoValue={estadoValue}
          fechaInicioValue={fechaInicioValue}
          fechaVencimientoValue={fechaVencimientoValue}
          metodoPagoDisplayName={metodoPagoDisplayName}
          metodosPagoActivos={metodosPagoActivos}
          onCancel={onCancel}
          onCicloPagoChange={handleCicloPagoChange}
          onFechaVencimientoSelect={handleFechaVencimientoSelect}
          onNext={handleNext}
          openFechaInicio={openFechaInicio}
          openFechaVencimiento={openFechaVencimiento}
          register={register}
          renovacionAutomaticaValue={renovacionAutomaticaValue}
          setOpenFechaInicio={setOpenFechaInicio}
          setOpenFechaVencimiento={setOpenFechaVencimiento}
          setValue={setValue}
          simboloMoneda={simboloMoneda}
          tipoPlanValue={tipoPlanValue}
          tiposPlanesDinamicos={tiposPlanesDinamicos}
        />

        <ServicioPreviewTab
          categoriaNombre={categoriaNombre}
          cicloPagoValue={cicloPagoValue}
          contrasenaValue={contrasenaValue}
          correoValue={correoValue}
          costoServicioValue={costoServicioValue}
          fechaInicioValue={fechaInicioValue}
          fechaVencimientoValue={fechaVencimientoValue}
          hasChanges={hasChanges}
          isEditMode={isEditMode}
          isSubmitting={isSubmitting}
          metodoPagoDisplayName={metodoPagoDisplayName}
          nombreValue={nombreValue}
          onPrevious={handlePrevious}
          perfilesDisponiblesValue={perfilesDisponiblesValue}
          renovacionAutomaticaValue={renovacionAutomaticaValue}
          simboloMoneda={simboloMoneda}
          tipoPlanValue={tipoPlanValue}
          tiposPlanesDinamicos={tiposPlanesDinamicos}
        />
      </Tabs>
    </form>
  );
}