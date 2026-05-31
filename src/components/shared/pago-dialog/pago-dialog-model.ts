import type { MetodoPago } from '@/types';
import type { Plan } from '@/types/categorias';
import { roundToDecimals } from '@/platform/utils/calculations';
import {
  getTerceroMetodoPagoMoneda,
  getTerceroMetodoPagoNombre,
  isPendingTerceroPaymentMethodId,
  withPendingTerceroPaymentMethod,
} from '@/platform/utils/terceroMetodoPago';

import type { PagoDialogFormData } from './schema';
import type { EnrichedPagoDialogFormData, PagoDialogMode, PagoDialogProps } from './types';

type PaymentMethodsArgs = {
  context: PagoDialogProps['context'];
  mode: PagoDialogMode;
  metodosPago: MetodoPago[];
};

export function getPagoDialogPaymentMethods({
  context,
  mode,
  metodosPago,
}: PaymentMethodsArgs): MetodoPago[] {
  const isVenta = context === 'venta';
  const metodosBase = metodosPago.filter((metodo) =>
    metodo.activo && (isVenta ? metodo.asociadoA === 'tercero' : metodo.asociadoA === 'servicio')
  );

  const available = isVenta
    ? (mode === 'renew'
        ? metodosBase.filter((metodo) => !isPendingTerceroPaymentMethodId(metodo.id))
        : withPendingTerceroPaymentMethod(metodosBase))
    : metodosBase;

  if (!isVenta) {
    return [...available].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  const pending = available.filter((metodo) => isPendingTerceroPaymentMethodId(metodo.id));
  const rest = available
    .filter((metodo) => !isPendingTerceroPaymentMethodId(metodo.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return [...pending, ...rest];
}

type SelectedPlanArgs = {
  periodoValue?: string;
  categoriaPlanes?: Plan[];
  tipoPlan?: Plan['tipoPlan'];
};

export function getPagoDialogSelectedPlan({
  periodoValue,
  categoriaPlanes,
  tipoPlan,
}: SelectedPlanArgs): Plan | null {
  if (!periodoValue || !categoriaPlanes?.length) return null;
  return categoriaPlanes.find((plan) =>
    plan.cicloPago === periodoValue && (!tipoPlan || plan.tipoPlan === tipoPlan)
  ) ?? null;
}

type VentaPaymentContext = Extract<PagoDialogProps, { context: 'venta' }>['venta'];

type SubmitPayloadArgs = {
  data: PagoDialogFormData;
  metodosPago: MetodoPago[];
  selectedPlan?: Plan | null;
  venta?: VentaPaymentContext;
  previewMessage?: string;
};

export function buildPagoDialogSubmitPayload({
  data,
  metodosPago,
  selectedPlan,
  venta,
  previewMessage,
}: SubmitPayloadArgs): EnrichedPagoDialogFormData {
  const metodoPago = metodosPago.find((metodo) => metodo.id === data.metodoPagoId);
  const costo = roundToDecimals(data.costo);
  const descuento = data.descuento === undefined ? undefined : roundToDecimals(data.descuento);

  return {
    ...data,
    costo,
    descuento,
    notas: data.notas?.trim() ?? '',
    metodoPagoNombre: getTerceroMetodoPagoNombre(data.metodoPagoId, metodoPago?.nombre),
    moneda: getTerceroMetodoPagoMoneda(data.metodoPagoId, metodoPago?.moneda),
    planId: selectedPlan?.id ?? venta?.planId,
    planNombre: selectedPlan?.nombre ?? venta?.planNombre,
    planTipoNombre: venta?.planTipoNombre,
    mensajeWhatsApp: data.notificarWhatsApp && previewMessage ? previewMessage : undefined,
  };
}
