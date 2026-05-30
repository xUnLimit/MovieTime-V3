import { ENTITIES } from '@/platform/supabase/entities';
import { getVentaDetalleRead } from '@/platform/supabase/domain-read-adapters';
import {
  countVentas,
  queryVentas,
  queryPagosVenta,
} from '@/platform/supabase/ventas-repository';
import type { PagoVenta, VentaDoc } from '@/types';

export const VENTAS_COLLECTION = ENTITIES.VENTAS;
export { timestampToDate } from '@/platform/supabase/dates';

export function getVentaDetalleUseCase(id: string) {
  return getVentaDetalleRead(id);
}

export async function fetchVentasCountsUseCase() {
  const [totalVentas, ventasActivas, ventasInactivas] = await Promise.all([
    countVentas([]),
    countVentas([{ field: 'estado', operator: '==', value: 'activo' }]),
    countVentas([{ field: 'estado', operator: '==', value: 'inactivo' }]),
  ]);

  return { totalVentas, ventasActivas, ventasInactivas };
}

export async function fetchVentasByClienteIdsUseCase<T = VentaDoc>(
  clienteIds: string[],
  chunkSize = 30,
): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < clienteIds.length; i += chunkSize) {
    chunks.push(clienteIds.slice(i, i + chunkSize));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      queryVentas<T>([{ field: 'clienteId', operator: 'in', value: chunk }])
    )
  );
  return results.flat();
}

export function queryVentasByServicioUseCase<T = VentaDoc>(servicioId: string) {
  return queryVentas<T>([
    { field: 'servicioId', operator: '==', value: servicioId },
  ]);
}

export function queryVentasActivasByServiciosUseCase<T = VentaDoc>(servicioIds: string[]) {
  return queryVentas<T>([
    { field: 'servicioId', operator: 'in', value: servicioIds },
    { field: 'estado', operator: '!=', value: 'inactivo' },
  ]);
}

export function queryVentasByClienteUseCase<T = VentaDoc>(clienteId: string) {
  return queryVentas<T>([
    { field: 'clienteId', operator: '==', value: clienteId },
  ]);
}

export function queryPagosVentaByVentaUseCase<T = PagoVenta>(ventaId: string) {
  return queryPagosVenta<T>([
    { field: 'ventaId', operator: '==', value: ventaId },
  ]);
}

export function countVentasActivasByServicioUseCase(servicioId: string) {
  return countVentas([
    { field: 'servicioId', operator: '==', value: servicioId },
    { field: 'estado', operator: '!=', value: 'inactivo' },
  ]);
}

export async function fetchPagosVentaByVentaIdsUseCase<T = PagoVenta>(
  ventaIds: string[],
  chunkSize = 10,
): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ventaIds.length; i += chunkSize) {
    chunks.push(ventaIds.slice(i, i + chunkSize));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      queryPagosVenta<T>([{ field: 'ventaId', operator: 'in', value: chunk }])
    )
  );
  return results.flat();
}
