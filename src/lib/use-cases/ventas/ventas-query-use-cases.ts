import { timestampToDate } from '@/lib/supabase/dates';
import { ENTITIES, type QueryFilter } from '@/lib/supabase/entities';
import {
  countVentas,
  getVentaById,
  queryPagosVenta,
  queryVentas,
} from '@/lib/supabase/ventas-repository';
import type { PagoVenta, VentaDoc } from '@/types';

export const VENTAS_COLLECTION = ENTITIES.VENTAS;
export { timestampToDate };

export function getVentaUseCase<T = VentaDoc>(id: string) {
  return getVentaById<T>(id);
}

export function fetchVentasByFiltersUseCase<T = VentaDoc>(filters: QueryFilter[] = []) {
  return queryVentas<T>(filters);
}

export function fetchVentasByClienteUseCase<T = VentaDoc>(clienteId: string) {
  return queryVentas<T>([{ field: 'clienteId', operator: '==', value: clienteId }]);
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

export function fetchVentasByServicioUseCase<T = VentaDoc>(servicioId: string) {
  return queryVentas<T>([{ field: 'servicioId', operator: '==', value: servicioId }]);
}

export function countVentasActivasByServicioUseCase(servicioId: string) {
  return countVentas([
    { field: 'servicioId', operator: '==', value: servicioId },
    { field: 'estado', operator: '!=', value: 'inactivo' },
  ]);
}

export function fetchPagosVentaByVentaUseCase<T = PagoVenta>(ventaId: string) {
  return queryPagosVenta<T>([{ field: 'ventaId', operator: '==', value: ventaId }]);
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
