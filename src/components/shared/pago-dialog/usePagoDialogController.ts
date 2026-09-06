"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths } from "date-fns";
import { useForm } from "react-hook-form";

import { useTemplates } from "@/hooks/use-templates";
import { createMutationIntent } from '@/platform/utils/mutation-intent';
import { getCurrencySymbol } from "@/platform/constants";
import { reportError } from "@/platform/observability/logger";
import { calculateDiscountedAmount, roundToDecimals } from "@/platform/utils/calculations";
import { getServicioMetodoPagoNombre } from "@/platform/utils/servicioMetodoPago";
import {
  getTerceroMetodoPagoMoneda,
  getTerceroMetodoPagoNombre,
} from "@/platform/utils/terceroMetodoPago";
import type { TemplateMensaje } from "@/types";

import { pagoDialogSchema, type PagoDialogFormData } from "./schema";
import type { PagoDialogProps } from "./types";
import { buildVentaPreviewMessage, getCicloPagoMonths, getDefaultCosto, getDefaultMetodoPagoId, getPagoDialogCopy, getPagoDialogPresentation, getPagoDialogResetValues, getPagoDialogTargetKey, hasServicioPagoChanges } from "./helpers";
import { buildPagoDialogSubmitPayload, getPagoDialogPaymentMethods, getPagoDialogSelectedPlan } from "./pago-dialog-model";
import { usePagoDialogNumberInputs } from "./usePagoDialogNumberInputs";

export function usePagoDialogController(props: PagoDialogProps) {
  const intent = useRef(createMutationIntent());
  const submitting = useRef(false);
  const [fechaInicioOpen, setFechaInicioOpen] = useState(false);
  const [fechaVencimientoOpen, setFechaVencimientoOpen] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const isVenta = props.context === 'venta';
  const isEdit = props.mode === 'edit';
  const venta = props.context === 'venta' ? props.venta : null;
  const servicio = props.context === 'servicio' ? props.servicio : null;
  const pago = props.pago ?? null;
  const resetSessionRef = useRef<{ open: boolean; targetKey: string | null }>({
    open: false,
    targetKey: null,
  });
  const { metodosPago } = props;
  const { data: templates = [] } = useTemplates();
  const getTemplateByTipo = useCallback(
    (tipo: TemplateMensaje['tipo']) =>
      templates.find((template) => template.tipo === tipo && template.activo),
    [templates],
  );
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
      metodoPagoId: getDefaultMetodoPagoId(props),
      costo: getDefaultCosto(props),
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
  const {
    costoInput,
    descuentoInput,
    isCostoFocused,
    isDescuentoFocused,
    setCostoInput,
    setDescuentoInput,
    setIsCostoFocused,
    setIsDescuentoFocused,
  } = usePagoDialogNumberInputs();

  const metodosPagoOrdenados = useMemo(() => getPagoDialogPaymentMethods({
    context: props.context,
    mode: props.mode,
    metodosPago,
  }), [metodosPago, props.context, props.mode]);
  const metodoPagoSeleccionado = metodosPagoOrdenados.find((m) => m.id === metodoPagoIdValue);
  const metodoPagoDisplayName = isVenta
    ? getTerceroMetodoPagoNombre(metodoPagoIdValue, metodoPagoSeleccionado?.nombre)
    : getServicioMetodoPagoNombre(metodoPagoSeleccionado, 'Seleccionar método');
  const currencySymbol = getCurrencySymbol(getTerceroMetodoPagoMoneda(metodoPagoIdValue, metodoPagoSeleccionado?.moneda));
  const selectedPlan = useMemo(() => getPagoDialogSelectedPlan({
    periodoValue,
    categoriaPlanes: props.categoriaPlanes,
    tipoPlan: props.tipoPlan,
  }), [periodoValue, props.categoriaPlanes, props.tipoPlan]);
  // getPagoDialogTargetKey solo lee context, mode, venta.clienteNombre, servicio.id/nombre y pago?.id.
  // Los deps enumeran exactamente esos campos primitivos; depender de `props` entero recalcularia
  // en cada render (props es un objeto nuevo). Los deps son completos y correctos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dialogTargetKey = useMemo(() => getPagoDialogTargetKey(props), [
    props.context,
    props.mode,
    pago?.id,
    servicio?.id,
    servicio?.nombre,
    venta?.clienteNombre,
  ]);
  // getPagoDialogResetValues lee context, mode, pago, y campos puntuales de venta/servicio.
  // Los deps enumeran exactamente esos campos; depender de `props` entero recalcularia en cada
  // render (props es un objeto nuevo). Los deps son completos y correctos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resetValues = useMemo(() => getPagoDialogResetValues(props), [
    props.context,
    props.mode,
    props.categoriaPlanes,
    props.tipoPlan,
    pago,
    servicio?.cicloPago,
    servicio?.costoServicio,
    servicio?.fechaVencimiento,
    servicio?.metodoPagoId,
    servicio?.notas,
    servicio?.renovacionAutomatica,
    venta?.fechaFin,
    venta?.metodoPagoId,
    venta?.notas,
    venta?.precioFinal,
  ]);
  const costoNormalizado = roundToDecimals(Number(costoValue) || 0);
  const descuentoNumero = Number(descuentoValue) || 0;
  const precioFinal = calculateDiscountedAmount(costoNormalizado, descuentoNumero);

  useEffect(() => {
    if (!props.open) {
      resetSessionRef.current = { open: false, targetKey: null };
      return;
    }

    const shouldInitialize =
      !resetSessionRef.current.open ||
      resetSessionRef.current.targetKey !== dialogTargetKey;

    resetSessionRef.current = { open: true, targetKey: dialogTargetKey };

    if (!shouldInitialize) return;
    intent.current = createMutationIntent();
    if (resetValues) reset(resetValues);
  }, [
    props.open,
    dialogTargetKey,
    resetValues,
    reset,
  ]);

  useEffect(() => {
    if (fechaInicioValue && periodoValue && periodoValue !== '') {
      const nuevaFechaVencimiento = addMonths(fechaInicioValue, getCicloPagoMonths(periodoValue));
      setValue('fechaVencimiento', nuevaFechaVencimiento);
    }
  }, [periodoValue, fechaInicioValue, setValue]);

  useEffect(() => {
    try {
      setPreviewMessage(buildVentaPreviewMessage({
        isVenta,
        isEdit,
        notificarWhatsAppValue,
        template: getTemplateByTipo('renovacion'),
        costoValue,
        descuentoValue,
        fechaVencimientoValue,
        clienteNombre: props.clienteNombre,
        clienteSoloNombre: props.clienteSoloNombre,
        servicioNombre: props.servicioNombre,
        categoriaNombre: props.categoriaNombre,
        perfilNombre: props.perfilNombre,
        correo: props.correo,
        contrasena: props.contrasena,
        codigo: props.codigo,
      }));
    } catch (error) {
      reportError('PagoDialog', 'Error generando mensaje', error);
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
    return hasServicioPagoChanges({
      pago: props.pago,
      periodoValue,
      metodoPagoIdValue,
      costoValue,
      fechaInicioValue,
      fechaVencimientoValue,
      notasValue,
    });
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
  ]);

  const onSubmit = async (data: PagoDialogFormData) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const enrichedData = buildPagoDialogSubmitPayload({
        data,
        metodosPago: metodosPagoOrdenados,
        selectedPlan,
        venta: venta ?? undefined,
        previewMessage,
      });
      await props.onConfirm({ ...enrichedData, idempotencyKey: intent.current.keyFor(enrichedData) });
      // The owner closes only after confirmed success. It may catch an error to
      // show a toast; closing here would discard the intent needed for retry.
    } finally {
      submitting.current = false;
    }
  };

  const handleCancel = () => {
    if (submitting.current) return;
    setIsCostoFocused(false);
    reset();
    props.onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && submitting.current) return;
    props.onOpenChange(open);
  };

  const shouldRender = !(!isVenta && isEdit && !pago);

  const { title, description } = getPagoDialogCopy({
    isEdit,
    isVenta,
    pagoDescripcion: pago?.descripcion,
    servicioNombre: servicio?.nombre,
    ventaClienteNombre: venta?.clienteNombre,
  });
  const submitDisabled = isSubmitting || (!isVenta && isEdit && !hasChanges);
  const { dialogContentClassName, notasLabel, notasPlaceholder } = getPagoDialogPresentation(isVenta, isEdit);
  return {
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
    handleOpenChange,
  };
}
