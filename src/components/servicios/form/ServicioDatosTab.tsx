import { TabsContent } from "@/components/ui/tabs";
import type { ServicioFormData } from "@/components/servicios/form/servicio-form-schema";
import type { Categoria, MetodoPago, TipoPlanConfig } from "@/types";

import { ServicioDatosBasicosSection } from "./ServicioDatosBasicosSection";
import { ServicioDatosFooterActions } from "./ServicioFormActions";
import { ServicioEstadoSection } from "./ServicioEstadoSection";
import { ServicioFinanzasSection } from "./ServicioFinanzasSection";
import { ServicioSeguridadSection } from "./ServicioSeguridadSection";
import type {
  FechaPopoverSetter,
  ServicioFormBindings,
} from "./types";

interface ServicioDatosTabProps extends ServicioFormBindings {
  categoriaNombre: string;
  categoriasActivas: Categoria[];
  cicloPagoValue: ServicioFormData["cicloPago"];
  diasReposoValue?: string;
  estadoValue: ServicioFormData["estado"];
  fechaInicioValue: Date;
  fechaVencimientoValue: Date;
  metodoPagoDisplayName: string;
  metodosPagoActivos: MetodoPago[];
  onCancel: () => void;
  onCicloPagoChange: (ciclo: ServicioFormData["cicloPago"]) => void;
  onFechaVencimientoSelect: (date: Date) => void;
  onNext: () => void;
  openFechaInicio: boolean;
  openFechaVencimiento: boolean;
  renovacionAutomaticaValue: boolean;
  setOpenFechaInicio: FechaPopoverSetter;
  setOpenFechaVencimiento: FechaPopoverSetter;
  simboloMoneda: string;
  tipoPlanValue: string;
  tiposPlanesDinamicos: TipoPlanConfig[];
}

export function ServicioDatosTab({
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
  onCicloPagoChange,
  onFechaVencimientoSelect,
  onNext,
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
}: ServicioDatosTabProps) {
  return (
    <TabsContent value="datos" className="flex flex-col justify-between gap-3 pt-4">
      <ServicioDatosBasicosSection
        categoriaNombre={categoriaNombre}
        categoriasActivas={categoriasActivas}
        errors={errors}
        register={register}
        setValue={setValue}
      />

      <ServicioSeguridadSection
        errors={errors}
        register={register}
        setValue={setValue}
      />

      <ServicioFinanzasSection
        cicloPagoValue={cicloPagoValue}
        errors={errors}
        fechaInicioValue={fechaInicioValue}
        fechaVencimientoValue={fechaVencimientoValue}
        metodoPagoDisplayName={metodoPagoDisplayName}
        metodosPagoActivos={metodosPagoActivos}
        onCicloPagoChange={onCicloPagoChange}
        onFechaVencimientoSelect={onFechaVencimientoSelect}
        openFechaInicio={openFechaInicio}
        openFechaVencimiento={openFechaVencimiento}
        register={register}
        setOpenFechaInicio={setOpenFechaInicio}
        setOpenFechaVencimiento={setOpenFechaVencimiento}
        setValue={setValue}
        simboloMoneda={simboloMoneda}
        tipoPlanValue={tipoPlanValue}
        tiposPlanesDinamicos={tiposPlanesDinamicos}
      />

      <ServicioEstadoSection
        diasReposoValue={diasReposoValue}
        errors={errors}
        estadoValue={estadoValue}
        register={register}
        renovacionAutomaticaValue={renovacionAutomaticaValue}
        setValue={setValue}
      />

      <ServicioDatosFooterActions onCancel={onCancel} onNext={onNext} />
    </TabsContent>
  );
}
