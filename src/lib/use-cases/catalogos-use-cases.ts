import {
  getMetodoPagoById,
  queryMetodosPago,
} from '@/lib/supabase/catalogos-repository';
import type { QueryFilter } from '@/lib/supabase/entities';
import type { MetodoPago } from '@/types';

export function getMetodoPagoUseCase<T = MetodoPago>(id: string) {
  return getMetodoPagoById<T>(id);
}

export function fetchMetodosPagoByFiltersUseCase<T = MetodoPago>(filters: QueryFilter[] = []) {
  return queryMetodosPago<T>(filters);
}

export function fetchMetodosPagoTercerosUseCase<T = MetodoPago>() {
  return queryMetodosPago<T>([{ field: 'asociadoA', operator: '==', value: 'tercero' }]);
}

export function fetchMetodosPagoServiciosUseCase<T = MetodoPago>() {
  return queryMetodosPago<T>([{ field: 'asociadoA', operator: '==', value: 'servicio' }]);
}
