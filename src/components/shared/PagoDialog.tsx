'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Pencil, RefreshCw } from 'lucide-react';
import { cn } from '@/platform/utils';
import {
  CostoField,
  DateField,
  DescuentoField,
  MetodoPagoField,
  NotesField,
  PeriodoField,
} from './pago-dialog/fields';
import { PreviewSection } from './pago-dialog/PreviewSection';
import type { PagoDialogProps } from './pago-dialog/types';
import { usePagoDialogController } from './pago-dialog/usePagoDialogController';

export type { EnrichedPagoDialogFormData } from './pago-dialog/types';

export function PagoDialog(props: PagoDialogProps) {
  const {
    shouldRender,
    isVenta,
    isEdit,
    title,
    description,
    dialogContentClassName,
    register,
    handleSubmit,
    setValue,
    clearErrors,
    errors,
    fechaInicioOpen,
    setFechaInicioOpen,
    fechaVencimientoOpen,
    setFechaVencimientoOpen,
    previewMessage,
    setPreviewMessage,
    isCostoFocused,
    setIsCostoFocused,
    isDescuentoFocused,
    setIsDescuentoFocused,
    costoInput,
    setCostoInput,
    descuentoInput,
    setDescuentoInput,
    periodoValue,
    metodoPagoIdValue,
    notificarWhatsAppValue,
    costoValue,
    descuentoValue,
    fechaInicioValue,
    fechaVencimientoValue,
    renovacionAutomaticaValue,
    metodosPagoOrdenados,
    metodoPagoDisplayName,
    currencySymbol,
    costoNormalizado,
    precioFinal,
    notasLabel,
    notasPlaceholder,
    submitDisabled,
    onSubmit,
    handleCancel,
  } = usePagoDialogController(props);

  if (!shouldRender) return null;

  const renderPeriodoField = () => (
    <PeriodoField
      periodoValue={periodoValue}
      categoriaPlanes={props.categoriaPlanes}
      tipoPlan={props.tipoPlan}
      setValue={setValue}
      clearErrors={clearErrors}
      errors={errors}
    />
  );

  const renderMetodoField = () => (
    <MetodoPagoField
      isVenta={isVenta}
      metodoPagoIdValue={metodoPagoIdValue}
      metodoPagoDisplayName={metodoPagoDisplayName}
      metodosPagoOrdenados={metodosPagoOrdenados}
      setValue={setValue}
      clearErrors={clearErrors}
      errors={errors}
    />
  );

  const renderCostoField = (label: string) => (
    <CostoField
      label={label}
      currencySymbol={currencySymbol}
      isCostoFocused={isCostoFocused}
      costoInput={costoInput}
      costoValue={costoValue}
      costoNormalizado={costoNormalizado}
      setIsCostoFocused={setIsCostoFocused}
      setCostoInput={setCostoInput}
      setValue={setValue}
      errors={errors}
    />
  );

  const renderDescuentoField = () => (
    <DescuentoField
      isDescuentoFocused={isDescuentoFocused}
      descuentoInput={descuentoInput}
      descuentoValue={descuentoValue}
      setIsDescuentoFocused={setIsDescuentoFocused}
      setDescuentoInput={setDescuentoInput}
      setValue={setValue}
      errors={errors}
    />
  );

  const renderAutorrenovacionField = () => (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <div className="space-y-1">
        <Label htmlFor="renovacionAutomatica">Autorrenovable</Label>
        <p className="text-sm text-muted-foreground">
          Marca si este servicio se paga automaticamente.
        </p>
      </div>
      <Switch
        id="renovacionAutomatica"
        checked={Boolean(renovacionAutomaticaValue)}
        onCheckedChange={(checked) => setValue('renovacionAutomatica', checked)}
      />
    </div>
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={cn('max-w-[calc(100vw-2rem)]', dialogContentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {isVenta ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {renderPeriodoField()}
                {renderMetodoField()}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderCostoField('Precio')}
                {renderDescuentoField()}
              </div>

              <div className="space-y-2">
                <Label>Precio Final</Label>
                <div className="h-9 w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm font-medium">
                  {currencySymbol} {precioFinal.toFixed(2)}
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {renderPeriodoField()}
              {renderMetodoField()}
              {renderCostoField('Costo')}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <DateField
              label="Fecha de Inicio"
              fieldName="fechaInicio"
              value={fechaInicioValue}
              open={fechaInicioOpen}
              setOpen={setFechaInicioOpen}
              setValue={setValue}
            />

            <DateField
              label="Fecha de Vencimiento"
              fieldName="fechaVencimiento"
              value={fechaVencimientoValue}
              open={fechaVencimientoOpen}
              setOpen={setFechaVencimientoOpen}
              setValue={setValue}
            />
          </div>

          <NotesField
            label={notasLabel}
            placeholder={notasPlaceholder}
            register={register}
          />

          {!isEdit && !isVenta && renderAutorrenovacionField()}

          {!isEdit && isVenta && (
            <PreviewSection
              notificarWhatsAppValue={notificarWhatsAppValue}
              previewMessage={previewMessage}
              setPreviewMessage={setPreviewMessage}
              setValue={setValue}
            />
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitDisabled} className="bg-purple-600 hover:bg-purple-700">
              {isEdit ? (
                <>
                  {!isVenta && <Pencil className="h-4 w-4 mr-2" />}
                  Guardar cambios
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Confirmar Renovación
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
