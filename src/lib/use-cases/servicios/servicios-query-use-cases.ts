import { countCategorias } from '@/lib/supabase/categorias-repository';
import { ENTITIES } from '@/lib/supabase/entities';
import {
  countServicios,
  queryServicios,
} from '@/lib/supabase/servicios-repository';
import type { Servicio } from '@/types';

export const SERVICIOS_COLLECTION = ENTITIES.SERVICIOS;

export async function fetchServiciosCountsUseCase() {
  const [totalServiciosRaw, serviciosEnReposo, serviciosActivosRaw, serviciosEnReposoDocs, totalCategoriasActivas] =
    await Promise.all([
      countServicios([]),
      countServicios([{ field: 'enReposo', operator: '==', value: true }]),
      countServicios([{ field: 'activo', operator: '==', value: true }]),
      queryServicios<Servicio>([{ field: 'enReposo', operator: '==', value: true }]),
      countCategorias([{ field: 'activo', operator: '==', value: true }]),
    ]);

  const serviciosActivosEnReposo = serviciosEnReposoDocs.filter((servicio) => servicio.activo).length;
  return {
    totalServicios: Math.max(0, totalServiciosRaw - serviciosEnReposo),
    serviciosActivos: Math.max(0, serviciosActivosRaw - serviciosActivosEnReposo),
    totalCategoriasActivas,
  };
}
