import type { MetodoPago } from '@/types';

export const PENDING_USER_PAYMENT_ID = 'pendiente';
export const PENDING_USER_PAYMENT_NAME = 'Pendiente';
export const PENDING_USER_PAYMENT_CURRENCY = 'USD';
export const USUARIO_METODO_PAGO_UPDATED_EVENT = 'usuario-metodo-pago-updated';

export function isPendingUserPaymentMethodId(metodoPagoId?: string | null): boolean {
  return !metodoPagoId || metodoPagoId === PENDING_USER_PAYMENT_ID;
}

export function getUsuarioMetodoPagoNombre(
  metodoPagoId?: string | null,
  metodoPagoNombre?: string | null
): string {
  if (!isPendingUserPaymentMethodId(metodoPagoId) && metodoPagoNombre?.trim()) {
    return metodoPagoNombre.trim();
  }

  return PENDING_USER_PAYMENT_NAME;
}

export function getUsuarioMetodoPagoMoneda(
  metodoPagoId?: string | null,
  moneda?: string | null
): string {
  if (isPendingUserPaymentMethodId(metodoPagoId)) {
    return PENDING_USER_PAYMENT_CURRENCY;
  }

  return moneda?.trim() || PENDING_USER_PAYMENT_CURRENCY;
}

export function createPendingUserPaymentMethod(): MetodoPago {
  return {
    id: PENDING_USER_PAYMENT_ID,
    nombre: PENDING_USER_PAYMENT_NAME,
    tipo: 'efectivo',
    pais: 'N/A',
    moneda: PENDING_USER_PAYMENT_CURRENCY,
    titular: '',
    identificador: '',
    activo: true,
    asociadoA: 'usuario',
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

export function withPendingUserPaymentMethod(metodosPago: MetodoPago[]): MetodoPago[] {
  const withoutPending = metodosPago.filter((metodo) => metodo.id !== PENDING_USER_PAYMENT_ID);
  return [createPendingUserPaymentMethod(), ...withoutPending];
}
