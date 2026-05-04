import type { MetodoPago } from '@/types';

type ServicioMetodoPagoDisplay = Pick<MetodoPago, 'nombre' | 'banco' | 'titular' | 'numeroTarjeta'>;

export function getServicioMetodoPagoNombre(
  metodoPago?: ServicioMetodoPagoDisplay | null,
  fallback = 'Seleccionar método de pago'
): string {
  if (!metodoPago) return fallback;

  const baseName = (metodoPago.banco || metodoPago.nombre || '').trim();
  const titular = (metodoPago.titular || '').trim();
  const lastDigits = metodoPago.numeroTarjeta?.replace(/\D/g, '').slice(-4) || '';
  const primaryLabel = [baseName, lastDigits].filter(Boolean).join(' ').trim();

  if (primaryLabel && titular) {
    return `${primaryLabel} - ${titular}`;
  }

  return primaryLabel || titular || fallback;
}
