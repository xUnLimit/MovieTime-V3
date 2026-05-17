'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Pencil, RefreshCw } from 'lucide-react';
import { addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import type { PagoServicio } from '@/types';
import { getCurrencySymbol } from '@/lib/constants';
import { calculateDiscountedAmount, roundToDecimals } from '@/lib/utils/calculations';
import { generarMensajeVenta } from '@/lib/utils/whatsapp';
import { useTemplatesStore } from '@/store/templatesStore';
import {
  getTerceroMetodoPagoMoneda,
  getTerceroMetodoPagoNombre,
  isPendingTerceroPaymentMethodId,
  PENDING_TERCERO_PAYMENT_ID,
  withPendingTerceroPaymentMethod,
} from '@/lib/utils/terceroMetodoPago';
import { getServicioMetodoPagoNombre } from '@/lib/utils/servicioMetodoPago';
import {
  CostoField,
  DateField,
  DescuentoField,
  MetodoPagoField,
  NotesField,
  PeriodoField,
} from './pago-dialog/fields';
import { PreviewSection } from './pago-dialog/PreviewSection';
import { pagoDialogSchema, type PagoDialogFormData } from './pago-dialog/schema';
import type { PagoDialogProps } from './pago-dialog/types';

export type { EnrichedPagoDialogFormData } from './pago-dialog/types';

export function PagoDialog(props: PagoDialogProps) {
  const [fechaInicioOpen, setFechaInicioOpen] = useState(false);
  const [fechaVencimientoOpen, setFechaVencimientoOpen] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const [isCostoFocused, setIsCostoFocused] = useState(false);
  const [isDescuentoFocused, setIsDescuentoFocused] = useState(false);
  const [costoInput, setCostoInput] = useState('');
  const [descuentoInput, setDescuentoInput] = useState('');
  const isVenta = props.context === 'venta';
  const isEdit = props.mode === 'edit';
  const venta = props.context === 'venta' ? props.venta : null;
  const servicio = props.context === 'servicio' ? props.servicio : null;
  const pago = props.pago ?? null;
  const { metodosPago } = props;
  const { getTemplateByTipo } = useTemplatesStore();
  const isVentaRenew = isVenta && props.mode === 'renew';

  const defaultMetodoPagoId = isVenta
    ? (isVentaRenew ? '' : venta?.metodoPagoId || PENDING_TERCERO_PAYMENT_ID)
    : (isEdit && pago ? pago.metodoPagoId || '' : servicio?.metodoPagoId || '');
  const defaultCosto = venta
    ? (props.mode === 'renew' ? roundToDecimals(venta.precioFinal || 0) : 0)
    : (props.mode === 'renew' ? roundToDecimals(servicio?.costoServicio || 0) : 0);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<PagoDialogFormData>({
    resolver: zodResolver(pagoDialogSchema),
    defaultValues: {
      periodoRenovacion: '',
      metodoPagoId: defaultMetodoPagoId,
      costo: defaultCosto,
      descuento: 0,
      fechaInicio: new Date(),
      fechaVencimiento: new Date(),
      notas: '',
      notificarWhatsApp: false,
      renovacionAutomatica: false,
    },
  });

  const periodoValue = watch('periodoRenovacion');
  const metodoPagoIdValue = watch('metodoPagoId');
  const notificarWhatsAppValue = watch('notificarWhatsApp');
  const costoValue = watch('costo');
  const descuentoValue = watch('descuento');
  const fechaInicioValue = watch('fechaInicio');
  const fechaVencimientoValue = watch('fechaVencimiento');
  const notasValue = watch('notas');
  const renovacionAutomaticaValue = watch('renovacionAutomatica');

  // Sincronizar inputs locales con valores del formulario cuando cambian externamente (ej: dropdown de ciclo)
  useEffect(() => {
    if (!isCostoFocused) {
      setCostoInput(costoValue !== undefined ? costoValue.toString() : '');
    }
  }, [costoValue, isCostoFocused]);

  useEffect(() => {
    if (!isDescuentoFocused) {
      setDescuentoInput(descuentoValue !== undefined ? descuentoValue.toString() : '');
    }
  }, [descuentoValue, isDescuentoFocused]);

  const metodosFiltrados = useMemo(() => {
    const metodosBase = metodosPago.filter((m) =>
      m.activo && (isVenta ? m.asociadoA === 'tercero' : m.asociadoA === 'servicio')
    );

    return isVenta
      ? (isVentaRenew
          ? metodosBase.filter((metodo) => !isPendingTerceroPaymentMethodId(metodo.id))
          : withPendingTerceroPaymentMethod(metodosBase))
      : metodosBase;
  }, [isVenta, isVentaRenew, metodosPago]);
  const metodosPagoOrdenados = useMemo(() => {
    if (isVenta) {
      const pendientes = metodosFiltrados.filter((metodo) => isPendingTerceroPaymentMethodId(metodo.id));
      const restantes = metodosFiltrados
        .filter((metodo) => !isPendingTerceroPaymentMethodId(metodo.id))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

      return [...pendientes, ...restantes];
    }

    return [...metodosFiltrados].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [isVenta, metodosFiltrados]);
  const metodoPagoSeleccionado = metodosPagoOrdenados.find((m) => m.id === metodoPagoIdValue);
  const metodoPagoDisplayName = isVenta
    ? getTerceroMetodoPagoNombre(metodoPagoIdValue, metodoPagoSeleccionado?.nombre)
    : getServicioMetodoPagoNombre(metodoPagoSeleccionado, 'Seleccionar método');
  const currencySymbol = getCurrencySymbol(getTerceroMetodoPagoMoneda(metodoPagoIdValue, metodoPagoSeleccionado?.moneda));
  const selectedPlan = useMemo(() => {
    if (!periodoValue || !props.categoriaPlanes?.length) return null;
    return props.categoriaPlanes.find((plan) =>
      plan.cicloPago === periodoValue && (!props.tipoPlan || plan.tipoPlan === props.tipoPlan)
    ) ?? null;
  }, [periodoValue, props.categoriaPlanes, props.tipoPlan]);
  const costoNormalizado = roundToDecimals(Number(costoValue) || 0);
  const descuentoNumero = Number(descuentoValue) || 0;
  const precioFinal = calculateDiscountedAmount(costoNormalizado, descuentoNumero);

  useEffect(() => {
    if (!props.open) return;

    if (props.context === 'venta') {
      if (isEdit) {
        if (props.pago) {
          reset({
            periodoRenovacion: props.pago.cicloPago || '',
            metodoPagoId: (props.pago.metodoPagoId as string) || venta?.metodoPagoId || PENDING_TERCERO_PAYMENT_ID,
            costo: roundToDecimals(props.pago.precio ?? 0),
            descuento: (props.pago.descuento as number) ?? 0,
            fechaInicio: props.pago.fechaInicio ? new Date(props.pago.fechaInicio) : new Date(),
            fechaVencimiento: props.pago.fechaVencimiento ? new Date(props.pago.fechaVencimiento) : new Date(),
            notas: props.pago.notas ?? '',
            renovacionAutomatica: false,
          });
          return;
        }
        reset({
          periodoRenovacion: '',
          metodoPagoId: venta?.metodoPagoId || PENDING_TERCERO_PAYMENT_ID,
          costo: 0,
          descuento: 0,
          fechaInicio: new Date(),
          fechaVencimiento: new Date(),
          notas: '',
          renovacionAutomatica: false,
        });
        return;
      }

      const fechaVencimientoActual = venta?.fechaFin ? new Date(venta.fechaFin) : new Date();
      reset({
        periodoRenovacion: '',
        metodoPagoId: '',
        costo: roundToDecimals(venta?.precioFinal || 0),
        descuento: 0,
        fechaInicio: fechaVencimientoActual,
        fechaVencimiento: fechaVencimientoActual,
        notas: venta?.notas ?? '',
        renovacionAutomatica: false,
      });
      return;
    }

    if (isEdit) {
      if (!props.pago || !servicio) return;
      reset({
        periodoRenovacion: props.pago.cicloPago || servicio.cicloPago || '',
        metodoPagoId: props.pago.metodoPagoId || '',
        costo: roundToDecimals(props.pago.monto),
        fechaInicio: new Date(props.pago.fechaInicio),
        fechaVencimiento: new Date(props.pago.fechaVencimiento),
        notas: props.pago.notas ?? servicio?.notas ?? '',
        renovacionAutomatica: servicio.renovacionAutomatica ?? false,
      });
      return;
    }

    const fechaVencimientoActual = servicio?.fechaVencimiento
      ? new Date(servicio.fechaVencimiento)
      : new Date();
    reset({
      periodoRenovacion: '',
      metodoPagoId: servicio?.metodoPagoId || '',
      costo: roundToDecimals(servicio?.costoServicio || 0),
      fechaInicio: fechaVencimientoActual,
      fechaVencimiento: fechaVencimientoActual,
      notas: servicio?.notas ?? '',
      renovacionAutomatica: servicio?.renovacionAutomatica ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.open,
    props.pago,
    servicio?.fechaVencimiento,
    servicio?.metodoPagoId,
    servicio?.costoServicio,
    servicio?.renovacionAutomatica,
  ]);

  useEffect(() => {
    if (fechaInicioValue && periodoValue && periodoValue !== '') {
      const meses =
        periodoValue === 'mensual' ? 1 :
        periodoValue === 'trimestral' ? 3 :
        periodoValue === 'semestral' ? 6 : 12;
      const nuevaFechaVencimiento = addMonths(fechaInicioValue, meses);
      setValue('fechaVencimiento', nuevaFechaVencimiento);
    }
  }, [periodoValue, fechaInicioValue, setValue]);

  // Generar vista previa del mensaje cuando notificarWhatsApp está activo
  useEffect(() => {
    if (!isVenta || !notificarWhatsAppValue || isEdit) {
      setPreviewMessage('');
      return;
    }

    const template = getTemplateByTipo('renovacion');
    if (!template) {
      setPreviewMessage('Template de renovación no encontrado');
      return;
    }

    const precioFinal = calculateDiscountedAmount(Number(costoValue) || 0, Number(descuentoValue) || 0);

    try {
      const mensaje = generarMensajeVenta(template.contenido, {
        clienteNombre: props.clienteNombre || 'Cliente',
        clienteSoloNombre: props.clienteSoloNombre,
        servicioNombre: props.servicioNombre || 'Servicio',
        categoriaNombre: props.categoriaNombre || 'Categoría',
        perfilNombre: props.perfilNombre || '',
        correo: props.correo || '',
        contrasena: props.contrasena || '',
        codigo: props.codigo || '',
        fechaVencimiento: fechaVencimientoValue || new Date(),
        monto: precioFinal,
      });
      setPreviewMessage(mensaje);
    } catch (error) {
      console.error('Error generando mensaje:', error);
      setPreviewMessage('Error generando mensaje de vista previa');
    }
  }, [
    notificarWhatsAppValue,
    isEdit,
    costoValue,
    descuentoValue,
    fechaVencimientoValue,
    props.clienteNombre,
    props.clienteSoloNombre,
    props.servicioNombre,
    props.categoriaNombre,
    props.perfilNombre,
    props.correo,
    props.contrasena,
    props.codigo,
    getTemplateByTipo,
    isVenta,
  ]);

  const hasChanges = useMemo(() => {
    if (props.context !== 'servicio' || props.mode !== 'edit') return true;
    if (!props.pago || !servicio) return false;
    const inicioPago = new Date(props.pago.fechaInicio).getTime();
    const vencimientoPago = new Date(props.pago.fechaVencimiento).getTime();
    return (
      periodoValue !== (props.pago.cicloPago || '') ||
      metodoPagoIdValue !== (props.pago.metodoPagoId || '') ||
      costoValue !== roundToDecimals(props.pago.monto) ||
      fechaInicioValue?.getTime() !== inicioPago ||
      fechaVencimientoValue?.getTime() !== vencimientoPago ||
      (notasValue ?? '') !== (props.pago.notas ?? '')
    );
  }, [
    costoValue,
    fechaInicioValue,
    fechaVencimientoValue,
    notasValue,
    props.context,
    props.mode,
    metodoPagoIdValue,
    periodoValue,
    props.pago,
    servicio,
  ]);

  const onSubmit = async (data: PagoDialogFormData) => {
    // Agregar campos denormalizados del método de pago
    const metodoPago = metodosFiltrados.find(m => m.id === data.metodoPagoId);
    const costo = roundToDecimals(data.costo);
    const descuento = data.descuento === undefined ? undefined : roundToDecimals(data.descuento);
    const enrichedData = {
      ...data,
      costo,
      descuento,
      notas: data.notas?.trim() ?? '',
      metodoPagoNombre: getTerceroMetodoPagoNombre(data.metodoPagoId, metodoPago?.nombre),
      moneda: getTerceroMetodoPagoMoneda(data.metodoPagoId, metodoPago?.moneda),
      planId: selectedPlan?.id ?? venta?.planId,
      planNombre: selectedPlan?.nombre ?? venta?.planNombre,
      planTipoNombre: venta?.planTipoNombre,
      // Pasar el mensaje editado (solo si hay WhatsApp activado)
      mensajeWhatsApp: data.notificarWhatsApp && previewMessage ? previewMessage : undefined,
    };
    props.onConfirm(enrichedData);
    props.onOpenChange(false);
  };

  const handleCancel = () => {
    setIsCostoFocused(false);
    reset();
    props.onOpenChange(false);
  };

  if (!isVenta && isEdit && !pago) return null;

  const title = isVenta
    ? (isEdit ? 'Editar Pago' : `Renovar Venta: ${venta?.clienteNombre || ''}`)
    : (isEdit ? `Editar pago del servicio: ${servicio?.nombre || ''}` : `Renovar Servicio: ${servicio?.nombre || ''}`);
  const description = isVenta
    ? (isEdit
        ? 'Actualiza la información del pago seleccionado.'
        : 'Registre un nuevo pago para esta venta para extender su fecha de vencimiento.')
    : (isEdit
        ? `Corrija los datos del último pago registrado (${(pago as PagoServicio | null)?.descripcion ?? 'Pago'}) si se ingresó algo incorrecto.`
        : 'Registre un nuevo pago para este servicio para extender su fecha de vencimiento.');

  const submitDisabled = isSubmitting || (!isVenta && isEdit && !hasChanges);
  const dialogContentClassName = isVenta
    ? 'sm:max-w-[600px]'
    : 'sm:max-w-[760px]';
  const notasLabel = isEdit ? 'Nota del pago' : 'Nota principal';
  const notasPlaceholder = isEdit
    ? 'Edita la nota historica de este pago...'
    : 'Edita la nota principal que se conservara para futuras renovaciones...';

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
