import { useMemo } from "react";
import { Users } from "lucide-react";

import { TabsContent } from "@/components/ui/tabs";
import type { ServicioFormData } from "@/components/servicios/form/servicio-form-schema";
import { formatearFecha } from "@/platform/utils/calculations";
import {
  PROFILE_PREVIEW_FULL_RENDER_LIMIT,
  getProfilePreviewSample,
} from "@/platform/utils/perfiles";
import type { TipoPlanConfig } from "@/types";

import { ServicioPreviewFooterActions } from "./ServicioFormActions";
import { getCicloLabel, getTipoPlanLabel } from "./servicio-form-helpers";

interface ServicioPreviewTabProps {
  categoriaNombre: string;
  cicloPagoValue: ServicioFormData["cicloPago"];
  contrasenaValue: string;
  correoValue: string;
  costoServicioValue: string;
  fechaInicioValue: Date;
  fechaVencimientoValue: Date;
  hasChanges: boolean;
  isEditMode: boolean;
  isSubmitting: boolean;
  metodoPagoDisplayName: string;
  nombreValue: string;
  onPrevious: () => void;
  perfilesDisponiblesValue: string;
  renovacionAutomaticaValue: boolean;
  simboloMoneda: string;
  tipoPlanValue: string;
  tiposPlanesDinamicos: TipoPlanConfig[];
}

export function ServicioPreviewTab({
  categoriaNombre,
  cicloPagoValue,
  contrasenaValue,
  correoValue,
  costoServicioValue,
  fechaInicioValue,
  fechaVencimientoValue,
  hasChanges,
  isEditMode,
  isSubmitting,
  metodoPagoDisplayName,
  nombreValue,
  onPrevious,
  perfilesDisponiblesValue,
  renovacionAutomaticaValue,
  simboloMoneda,
  tipoPlanValue,
  tiposPlanesDinamicos,
}: ServicioPreviewTabProps) {
  const perfilesPreviewTotal = Math.max(
    Number(perfilesDisponiblesValue) || 0,
    0,
  );
  const perfilesPreviewSample = useMemo(
    () =>
      getProfilePreviewSample(
        perfilesPreviewTotal,
        PROFILE_PREVIEW_FULL_RENDER_LIMIT,
      ),
    [perfilesPreviewTotal],
  );
  const hasAdditionalProfiles =
    perfilesPreviewTotal > PROFILE_PREVIEW_FULL_RENDER_LIMIT;

  return (
    <TabsContent value="perfil" className="space-y-3 pt-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-base font-semibold">Vista previa de perfiles</h3>
          <p className="text-sm text-muted-foreground">
            {perfilesDisponiblesValue
              ? `${Number(perfilesDisponiblesValue) || 0} de ${
                  Number(perfilesDisponiblesValue) || 0
                } perfiles actualmente disponibles.`
              : "Ingrese el número de perfiles en la pestaña anterior."}
          </p>
        </div>

        {perfilesPreviewTotal > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {perfilesPreviewSample.map((numero) => (
                <div
                  key={numero}
                  className="flex flex-col items-center justify-center rounded-lg border border-success-border bg-success-subtle p-4"
                >
                  <Users className="mb-2 h-8 w-8 text-success dark:text-white" />
                  <span className="text-sm font-medium text-success dark:text-white">
                    Perfil {numero}
                  </span>
                  <span className="mt-1 text-xs text-success">
                    Disponible
                  </span>
                </div>
              ))}
            </div>
            {hasAdditionalProfiles && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  +
                  {Math.max(
                    perfilesPreviewTotal - perfilesPreviewSample.length,
                    0,
                  )}{" "}
                  perfiles adicionales
                </span>
              </div>
            )}
          </div>
        ) : null}

        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <h4 className="font-semibold text-base mb-2">
            Resumen del servicio
          </h4>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  Nombre del servicio
                </span>
                <span className="font-medium">
                  {nombreValue || "Sin especificar"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  Categoría
                </span>
                <span className="font-medium">
                  {categoriaNombre || "Sin especificar"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  Tipo de plan
                </span>
                <span className="font-medium">
                  {getTipoPlanLabel(tipoPlanValue, tiposPlanesDinamicos)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  Perfiles disponibles
                </span>
                <span className="font-medium">
                  {perfilesDisponiblesValue || 0}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  Email de acceso
                </span>
                <span className="font-medium text-sm">
                  {correoValue || "Sin especificar"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  Contraseña
                </span>
                <span className="font-medium text-sm">
                  {contrasenaValue || "Sin especificar"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  Método de pago
                </span>
                <span className="font-medium">{metodoPagoDisplayName}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  Ciclo de facturación
                </span>
                <span className="font-medium">
                  {getCicloLabel(cicloPagoValue)}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block mb-1">
                Autorrenovacion
              </span>
              <span className="font-medium">
                {renovacionAutomaticaValue ? "Activada" : "Desactivada"}
              </span>
            </div>
          </div>

          <div className="border-t pt-3 mt-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  Fecha de inicio
                </span>
                <span className="font-medium">
                  {fechaInicioValue
                    ? formatearFecha(fechaInicioValue)
                    : "Sin especificar"}
                </span>
              </div>
              <div className="text-center">
                <span className="text-xs text-muted-foreground block mb-1">
                  Fecha de vencimiento
                </span>
                <span className="font-medium">
                  {fechaVencimientoValue
                    ? formatearFecha(fechaVencimientoValue)
                    : "Sin especificar"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground block mb-1">
                  Costo del servicio
                </span>
                <span className="font-medium text-primary text-base">
                  {simboloMoneda}{" "}
                  {costoServicioValue
                    ? Number(costoServicioValue).toFixed(2)
                    : "0.00"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ServicioPreviewFooterActions
        hasChanges={hasChanges}
        isEditMode={isEditMode}
        isSubmitting={isSubmitting}
        onPrevious={onPrevious}
      />
    </TabsContent>
  );
}
