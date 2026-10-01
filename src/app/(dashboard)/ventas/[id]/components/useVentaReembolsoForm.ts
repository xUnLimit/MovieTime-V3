import { useEffect, useMemo, useRef, useState } from 'react';
import { createMutationIntent } from '@/platform/utils/mutation-intent';
import { getCurrencySymbol } from '@/platform/constants';
import { getTerceroMetodoPagoMoneda, getTerceroMetodoPagoNombre, isPendingTerceroPaymentMethodId } from '@/platform/utils/terceroMetodoPago';
import type { MetodoPago, VentaDoc } from '@/types';
import type { VentaReembolsoConfirm } from './types';
import { calculateSuggestedRefundForDate, parseRefundDate } from './venta-refund-helpers';

export interface VentaReembolsoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venta: VentaDoc;
  metodosPago: MetodoPago[];
  montoSugerido: number;
  onConfirm: VentaReembolsoConfirm;
}

export type ReembolsoAccion = 'reembolso' | 'reembolso-corte';

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function useVentaReembolsoForm({
  open, onOpenChange, venta, metodosPago, montoSugerido, onConfirm,
}: VentaReembolsoDialogProps) {
  const intent = useRef(createMutationIntent());
  const submitting = useRef(false);
  useEffect(() => { if (open) intent.current = createMutationIntent(); }, [open]);
  const [step, setStep] = useState<'accion' | 'detalle'>('accion');
  const [accion, setAccion] = useState<ReembolsoAccion>('reembolso');
  const [monto, setMonto] = useState('');
  const [metodoPagoId, setMetodoPagoId] = useState('');
  const [destinoReembolso, setDestinoReembolso] = useState('');
  const [fecha, setFecha] = useState(toDateInputValue(new Date()));
  const [nota, setNota] = useState('');
  const [motivoCorte, setMotivoCorte] = useState('');
  const [inactivarServicio, setInactivarServicio] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const montoSugeridoFecha = useMemo(
    () => calculateSuggestedRefundForDate(venta, fecha),
    [fecha, venta],
  );

  const metodosDisponibles = useMemo(
    () => metodosPago
      .filter((metodo) => metodo.activo && metodo.asociadoA === 'tercero' && !isPendingTerceroPaymentMethodId(metodo.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [metodosPago]
  );
  const metodoSeleccionado = metodosDisponibles.find((metodo) => metodo.id === metodoPagoId);
  const moneda = getTerceroMetodoPagoMoneda(metodoPagoId, metodoSeleccionado?.moneda || venta.moneda || 'USD');
  const currencySymbol = getCurrencySymbol(moneda);
  const requiereMotivo = accion === 'reembolso-corte';
  const montoNumber = Number(monto);
  const refundDate = parseRefundDate(fecha);
  const canSubmit =
    Number.isFinite(montoNumber) &&
    montoNumber > 0 &&
    !!metodoPagoId &&
    destinoReembolso.trim().length > 0 &&
    refundDate !== null &&
    (!requiereMotivo || motivoCorte.trim().length > 0);

  // Reinicia el formulario al abrir o si cambia la venta/sugerencia con el dialogo abierto.
  const [resetFor, setResetFor] = useState<{ venta: VentaDoc; montoSugerido: number } | null>(null);
  if (!open && resetFor !== null) setResetFor(null);
  if (open && (resetFor?.venta !== venta || resetFor.montoSugerido !== montoSugerido)) {
    setResetFor({ venta, montoSugerido });
    const initialDate = toDateInputValue(new Date());
    setStep('accion');
    setAccion('reembolso');
    const initialSuggestion = calculateSuggestedRefundForDate(venta, initialDate) || montoSugerido;
    setMonto(initialSuggestion > 0 ? initialSuggestion.toFixed(2) : '');
    setMetodoPagoId(
      venta.metodoPagoId && !isPendingTerceroPaymentMethodId(venta.metodoPagoId)
        ? venta.metodoPagoId
        : ''
    );
    setDestinoReembolso('');
    setFecha(initialDate);
    setNota('');
    setMotivoCorte('');
    setInactivarServicio(false);
    setIsSubmitting(false);
  }

  const handleDateChange = (value: string) => {
    setFecha(value);
    const suggestion = calculateSuggestedRefundForDate(venta, value);
    setMonto(suggestion > 0 ? suggestion.toFixed(2) : '');
  };

  const handleClose = () => {
    if (!isSubmitting) onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm({
        idempotencyKey: intent.current.keyFor([venta.id, montoNumber, metodoPagoId, destinoReembolso, moneda, fecha, nota, requiereMotivo, inactivarServicio, motivoCorte]),
        monto: montoNumber,
        metodoPagoId,
        metodoPagoNombre: getTerceroMetodoPagoNombre(metodoPagoId, metodoSeleccionado?.nombre),
        destinoReembolso: destinoReembolso.trim(),
        moneda,
        fecha: refundDate as Date,
        nota: nota.trim(),
        cortarServicio: requiereMotivo,
        inactivarServicio: requiereMotivo && inactivarServicio,
        motivoCorte: motivoCorte.trim(),
      });
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    step, setStep, accion, setAccion, monto, setMonto, metodoPagoId, setMetodoPagoId,
    destinoReembolso, setDestinoReembolso, fecha, nota, setNota, motivoCorte, setMotivoCorte,
    inactivarServicio, setInactivarServicio, isSubmitting, montoSugeridoFecha,
    metodosDisponibles, currencySymbol, requiereMotivo, canSubmit,
    handleDateChange, handleClose, handleSubmit,
  };
}
