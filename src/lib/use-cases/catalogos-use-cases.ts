import { countMetodosPago } from '@/lib/supabase/catalogos-repository';

export async function fetchMetodosPagoCountsUseCase() {
  const [totalMetodos, metodosTerceros, metodosServicios] = await Promise.all([
    countMetodosPago([{ field: 'asociadoA', operator: 'in', value: ['tercero', 'servicio'] }]),
    countMetodosPago([{ field: 'asociadoA', operator: '==', value: 'tercero' }]),
    countMetodosPago([{ field: 'asociadoA', operator: '==', value: 'servicio' }]),
  ]);

  return { totalMetodos, metodosTerceros, metodosServicios };
}
