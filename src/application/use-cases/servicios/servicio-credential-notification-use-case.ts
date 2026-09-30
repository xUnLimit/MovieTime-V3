import { queryVentas } from '@/platform/supabase/ventas-repository';
import type { VentaDoc } from '@/types';

export async function getVentasActivasParaCredenciales(servicioId: string): Promise<VentaDoc[]> {
  return queryVentas<VentaDoc>([
    { field: 'servicioId', operator: '==', value: servicioId },
    { field: 'estado', operator: '!=', value: 'inactivo' },
  ]);
}
