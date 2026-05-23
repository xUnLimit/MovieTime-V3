import {
  countMetodosPago,
  queryMetodosPago,
} from '@/lib/supabase/catalogos-repository';
import type { QueryFilter } from '@/lib/supabase/entities';
import type { MetodoPago } from '@/types';

export async function fetchMetodosPagoCountsUseCase() {
  const [totalMetodos, metodosTerceros, metodosServicios] = await Promise.all([
    countMetodosPago([{ field: 'asociadoA', operator: 'in', value: ['tercero', 'servicio'] }]),
    countMetodosPago([{ field: 'asociadoA', operator: '==', value: 'tercero' }]),
    countMetodosPago([{ field: 'asociadoA', operator: '==', value: 'servicio' }]),
  ]);

  return { totalMetodos, metodosTerceros, metodosServicios };
}

export function fetchMetodosPagoByFiltersUseCase<T = MetodoPago>(filters: QueryFilter[] = []) {
  return queryMetodosPago<T>(filters);
}

