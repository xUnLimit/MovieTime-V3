import type { Plan } from '@/types/categorias';
import type { PagoServicio, TemplateMensaje } from '@/types';
import { calculateDiscountedAmount, roundToDecimals } from '@/lib/utils/calculations';
import { PENDING_TERCERO_PAYMENT_ID } from '@/lib/utils/terceroMetodoPago';
import { generarMensajeVenta } from '@/lib/utils/whatsapp';
import type { PagoDialogFormData } from './schema';
import type { PagoDialogProps } from './types';

const CICLOS_PAGO: Plan['cicloPago'][] = ['mensual', 'trimestral', 'semestral', 'anual'];

export const DECIMAL_INPUT_PATTERN = /^\d*\.?\d*$/;

export function getCicloPagoLabel(ciclo?: string) {
  return ciclo === 'mensual'
    ? 'Mensual'
    : ciclo === 'trimestral'
      ? 'Trimestral'
      : ciclo === 'semestral'
        ? 'Semestral'
        : ciclo === 'anual'
          ? 'Anual'
          : 'Seleccionar ciclo';
}

export function getCiclosDisponibles(categoriaPlanes?: Plan[], tipoPlan?: Plan['tipoPlan']) {
  const planes = categoriaPlanes
    ? categoriaPlanes.filter((plan) => !tipoPlan || plan.tipoPlan === tipoPlan)
    : [];

  return planes.length > 0
    ? CICLOS_PAGO.filter((ciclo) => planes.some((plan) => plan.cicloPago === ciclo))
    : CICLOS_PAGO;
}

export function getPrecioPorCiclo(
  ciclo: Plan['cicloPago'] | undefined,
  categoriaPlanes?: Plan[],
  tipoPlan?: Plan['tipoPlan']
) {
  if (!ciclo || !categoriaPlanes?.length) return null;

  const match = categoriaPlanes.find((plan) =>
    plan.cicloPago === ciclo && (!tipoPlan || plan.tipoPlan === tipoPlan)
  );

  return match?.precio ?? null;
}

export function getCicloPagoMonths(ciclo: string) {
  return ciclo === 'mensual'
    ? 1
    : ciclo === 'trimestral'
      ? 3
      : ciclo === 'semestral'
        ? 6
        : 12;
}

export function getDefaultMetodoPagoId(props: PagoDialogProps) {
  if (props.context === 'venta') {
    return props.mode === 'renew'
      ? ''
      : props.venta.metodoPagoId || PENDING_TERCERO_PAYMENT_ID;
  }

  return props.mode === 'edit' && props.pago
    ? props.pago.metodoPagoId || ''
    : props.servicio.metodoPagoId || '';
}

export function getDefaultCosto(props: PagoDialogProps) {
  if (props.context === 'venta') {
    return props.mode === 'renew'
      ? roundToDecimals(props.venta.precioFinal || 0)
      : 0;
  }

  return props.mode === 'renew'
    ? roundToDecimals(props.servicio.costoServicio || 0)
    : 0;
}

export function getPagoDialogTargetKey(props: PagoDialogProps) {
  if (props.context === 'venta') {
    return [
      props.context,
      props.mode,
      props.venta.clienteNombre ?? 'venta',
      props.mode === 'edit' ? props.pago?.id ?? 'nuevo-pago' : 'renovacion',
    ].join(':');
  }

  return [
    props.context,
    props.mode,
    props.servicio.id ?? props.servicio.nombre ?? 'servicio',
    props.mode === 'edit' ? props.pago?.id ?? 'nuevo-pago' : 'renovacion',
  ].join(':');
}

export function getPagoDialogResetValues(props: PagoDialogProps): PagoDialogFormData | null {
  if (props.context === 'venta') {
    const { venta } = props;

    if (props.mode === 'edit') {
      if (!props.pago) {
        return {
          periodoRenovacion: '',
          metodoPagoId: venta.metodoPagoId || PENDING_TERCERO_PAYMENT_ID,
          costo: 0,
          descuento: 0,
          fechaInicio: new Date(),
          fechaVencimiento: new Date(),
          notas: '',
          renovacionAutomatica: false,
        };
      }

      return {
        periodoRenovacion: props.pago.cicloPago || '',
        metodoPagoId: props.pago.metodoPagoId || venta.metodoPagoId || PENDING_TERCERO_PAYMENT_ID,
        costo: roundToDecimals(props.pago.precio ?? 0),
        descuento: props.pago.descuento ?? 0,
        fechaInicio: props.pago.fechaInicio ? new Date(props.pago.fechaInicio) : new Date(),
        fechaVencimiento: props.pago.fechaVencimiento ? new Date(props.pago.fechaVencimiento) : new Date(),
        notas: props.pago.notas ?? '',
        renovacionAutomatica: false,
      };
    }

    const fechaVencimientoActual = venta.fechaFin ? new Date(venta.fechaFin) : new Date();
    return {
      periodoRenovacion: '',
      metodoPagoId: '',
      costo: roundToDecimals(venta.precioFinal || 0),
      descuento: 0,
      fechaInicio: fechaVencimientoActual,
      fechaVencimiento: fechaVencimientoActual,
      notas: venta.notas ?? '',
      renovacionAutomatica: false,
    };
  }

  const { servicio } = props;

  if (props.mode === 'edit') {
    if (!props.pago) return null;

    return {
      periodoRenovacion: props.pago.cicloPago || servicio.cicloPago || '',
      metodoPagoId: props.pago.metodoPagoId || '',
      costo: roundToDecimals(props.pago.monto),
      fechaInicio: new Date(props.pago.fechaInicio),
      fechaVencimiento: new Date(props.pago.fechaVencimiento),
      notas: props.pago.notas ?? servicio.notas ?? '',
      renovacionAutomatica: servicio.renovacionAutomatica ?? false,
    };
  }

  const fechaVencimientoActual = servicio.fechaVencimiento
    ? new Date(servicio.fechaVencimiento)
    : new Date();

  return {
    periodoRenovacion: '',
    metodoPagoId: servicio.metodoPagoId || '',
    costo: roundToDecimals(servicio.costoServicio || 0),
    fechaInicio: fechaVencimientoActual,
    fechaVencimiento: fechaVencimientoActual,
    notas: servicio.notas ?? '',
    renovacionAutomatica: servicio.renovacionAutomatica ?? false,
  };
}

interface ServicioPagoChangesArgs {
  pago?: PagoServicio | null;
  periodoValue: string;
  metodoPagoIdValue: string;
  costoValue: number;
  fechaInicioValue?: Date;
  fechaVencimientoValue?: Date;
  notasValue?: string;
}

export function hasServicioPagoChanges({
  pago,
  periodoValue,
  metodoPagoIdValue,
  costoValue,
  fechaInicioValue,
  fechaVencimientoValue,
  notasValue,
}: ServicioPagoChangesArgs) {
  if (!pago) return false;

  const inicioPago = new Date(pago.fechaInicio).getTime();
  const vencimientoPago = new Date(pago.fechaVencimiento).getTime();

  return (
    periodoValue !== (pago.cicloPago || '') ||
    metodoPagoIdValue !== (pago.metodoPagoId || '') ||
    costoValue !== roundToDecimals(pago.monto) ||
    fechaInicioValue?.getTime() !== inicioPago ||
    fechaVencimientoValue?.getTime() !== vencimientoPago ||
    (notasValue ?? '') !== (pago.notas ?? '')
  );
}

interface VentaPreviewMessageArgs {
  isVenta: boolean;
  isEdit: boolean;
  notificarWhatsAppValue?: boolean;
  template?: TemplateMensaje;
  costoValue: number;
  descuentoValue?: number;
  fechaVencimientoValue?: Date;
  clienteNombre?: string;
  clienteSoloNombre?: string;
  servicioNombre?: string;
  categoriaNombre?: string;
  perfilNombre?: string;
  correo?: string;
  contrasena?: string;
  codigo?: string;
}

export function buildVentaPreviewMessage({
  isVenta,
  isEdit,
  notificarWhatsAppValue,
  template,
  costoValue,
  descuentoValue,
  fechaVencimientoValue,
  clienteNombre,
  clienteSoloNombre,
  servicioNombre,
  categoriaNombre,
  perfilNombre,
  correo,
  contrasena,
  codigo,
}: VentaPreviewMessageArgs) {
  if (!isVenta || !notificarWhatsAppValue || isEdit) return '';
  if (!template) return 'Template de renovación no encontrado';

  const precioFinal = calculateDiscountedAmount(Number(costoValue) || 0, Number(descuentoValue) || 0);

  return generarMensajeVenta(template.contenido, {
    clienteNombre: clienteNombre || 'Cliente',
    clienteSoloNombre,
    servicioNombre: servicioNombre || 'Servicio',
    categoriaNombre: categoriaNombre || 'Categoría',
    perfilNombre: perfilNombre || '',
    correo: correo || '',
    contrasena: contrasena || '',
    codigo: codigo || '',
    fechaVencimiento: fechaVencimientoValue || new Date(),
    monto: precioFinal,
  });
}

export function getPagoDialogPresentation(isVenta: boolean, isEdit: boolean) {
  return {
    dialogContentClassName: isVenta ? 'sm:max-w-[600px]' : 'sm:max-w-[760px]',
    notasLabel: isEdit ? 'Nota del pago' : 'Nota principal',
    notasPlaceholder: isEdit
      ? 'Edita la nota historica de este pago...'
      : 'Edita la nota principal que se conservara para futuras renovaciones...',
  };
}

interface PagoDialogCopyArgs {
  isEdit: boolean;
  isVenta: boolean;
  pagoDescripcion?: string;
  servicioNombre?: string;
  ventaClienteNombre?: string;
}

export function getPagoDialogCopy({
  isEdit,
  isVenta,
  pagoDescripcion,
  servicioNombre,
  ventaClienteNombre,
}: PagoDialogCopyArgs) {
  if (isVenta) {
    return {
      title: isEdit
        ? 'Editar Pago'
        : `Renovar Venta: ${ventaClienteNombre || ''}`,
      description: isEdit
        ? 'Actualiza la informaciÃ³n del pago seleccionado.'
        : 'Registre un nuevo pago para esta venta para extender su fecha de vencimiento.',
    };
  }

  return {
    title: isEdit
      ? `Editar pago del servicio: ${servicioNombre || ''}`
      : `Renovar Servicio: ${servicioNombre || ''}`,
    description: isEdit
      ? `Corrija los datos del Ãºltimo pago registrado (${pagoDescripcion ?? 'Pago'}) si se ingresÃ³ algo incorrecto.`
      : 'Registre un nuevo pago para este servicio para extender su fecha de vencimiento.',
  };
}
