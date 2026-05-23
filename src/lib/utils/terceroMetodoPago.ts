import type { MetodoPago } from '@/types';

export const PENDING_TERCERO_PAYMENT_ID = 'pendiente';
export const PENDING_TERCERO_PAYMENT_NAME = 'Pendiente';
export const PENDING_TERCERO_PAYMENT_CURRENCY = 'USD';

export function isPendingTerceroPaymentMethodId(metodoPagoId?: string | null): boolean {
  return !metodoPagoId || metodoPagoId === PENDING_TERCERO_PAYMENT_ID;
}

export function getTerceroMetodoPagoNombre(
  metodoPagoId?: string | null,
  metodoPagoNombre?: string | null
): string {
  if (!isPendingTerceroPaymentMethodId(metodoPagoId) && metodoPagoNombre?.trim()) {
    return metodoPagoNombre.trim();
  }

  return PENDING_TERCERO_PAYMENT_NAME;
}

export function getTerceroMetodoPagoMoneda(
  metodoPagoId?: string | null,
  moneda?: string | null
): string {
  if (isPendingTerceroPaymentMethodId(metodoPagoId)) {
    return PENDING_TERCERO_PAYMENT_CURRENCY;
  }

  return moneda?.trim() || PENDING_TERCERO_PAYMENT_CURRENCY;
}

export function createPendingTerceroPaymentMethod(): MetodoPago {
  return {
    id: PENDING_TERCERO_PAYMENT_ID,
    nombre: PENDING_TERCERO_PAYMENT_NAME,
    tipo: 'efectivo',
    pais: 'N/A',
    moneda: PENDING_TERCERO_PAYMENT_CURRENCY,
    titular: '',
    identificador: '',
    activo: true,
    asociadoA: 'tercero',
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

export function withPendingTerceroPaymentMethod(metodosPago: MetodoPago[]): MetodoPago[] {
  const withoutPending = metodosPago.filter((metodo) => metodo.id !== PENDING_TERCERO_PAYMENT_ID);
  return [createPendingTerceroPaymentMethod(), ...withoutPending];
}
