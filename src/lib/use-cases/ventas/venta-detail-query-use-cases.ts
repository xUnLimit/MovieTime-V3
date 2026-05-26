import {
  getCategoriaPlanesRead,
  getServicioContrasenaRead,
  getVentaDetalleRead,
  queryMetodosPagoTercerosRead,
} from '@/lib/supabase/domain-read-adapters';
import { getVentaConUltimoPagoUseCase } from '@/lib/use-cases/ventas/venta-current-payment-use-cases';
import { withPendingTerceroPaymentMethod } from '@/lib/utils/terceroMetodoPago';
import type { MetodoPago, VentaDoc } from '@/types';
import type { Plan } from '@/types/categorias';
import type { VentaDetalleQueryData } from '@/lib/use-cases/ventas/venta-detail-types';

export function getEstadoDetalle(venta: VentaDoc | null) {
  const esCortada = venta?.estado === 'inactivo' && !!venta?.cortadaAt;
  const estadoLabel = venta?.estado === 'inactivo' ? (esCortada ? 'Cortada' : 'Inactiva') : 'Activa';
  const estadoBadgeClass =
    venta?.estado === 'inactivo'
      ? (esCortada
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-600/20 dark:text-orange-400'
          : 'bg-red-100 text-red-700 dark:bg-red-600/20 dark:text-red-400')
      : 'bg-green-100 text-green-700 dark:bg-green-600/20 dark:text-green-400';

  return { esCortada, estadoBadgeClass, estadoLabel };
}

export async function fetchVentaDetalleQuery(id: string): Promise<VentaDetalleQueryData> {
  if (!id) return { venta: null, servicioContrasena: '' };

  const venta = await getVentaDetalleRead(id);
  if (!venta) return { venta: null, servicioContrasena: '' };

  const ventaConDatos = await getVentaConUltimoPagoUseCase(venta);
  const servicioContrasena = ventaConDatos.servicioId
    ? await getServicioContrasenaRead(ventaConDatos.servicioId).catch(() => '')
    : '';

  return { venta: ventaConDatos, servicioContrasena };
}

export async function fetchMetodosPagoTercerosWithPendingQuery(): Promise<MetodoPago[]> {
  const methods = await queryMetodosPagoTercerosRead();
  return withPendingTerceroPaymentMethod(Array.isArray(methods) ? methods : []);
}

export async function fetchCategoriaPlanesQuery(categoriaId: string): Promise<Plan[]> {
  return getCategoriaPlanesRead(categoriaId);
}
