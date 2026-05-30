import { countCategorias } from '@/platform/supabase/categorias-repository';
import { ENTITIES } from '@/platform/supabase/entities';
import {
  countServicios,
  getServicioById,
  queryServicios,
} from '@/platform/supabase/servicios-repository';
import type { Servicio } from '@/types';

export const SERVICIOS_COLLECTION = ENTITIES.SERVICIOS;

export function getServicioUseCase(id: string) {
  return getServicioById<Servicio>(id);
}

export function queryServiciosByCategoriaUseCase(categoriaId: string) {
  return queryServicios<Servicio>([
    { field: 'categoriaId', operator: '==', value: categoriaId },
  ]);
}

export function fetchServiciosByIdsUseCase(ids: string[]) {
  return queryServicios<Servicio>([
    { field: '__name__', operator: 'in', value: ids },
  ]);
}

export function countServiciosProximosPagoByCategoriaUseCase(categoriaId: string, fechaMaxima: Date) {
  return queryServicios<Servicio>([
    { field: 'categoriaId', operator: '==', value: categoriaId },
    { field: 'fechaVencimiento', operator: '<=', value: fechaMaxima },
  ]).then((servicios) => servicios.length);
}

export function queryServiciosEnReposoUseCase() {
  return queryServicios<Servicio>([{ field: 'enReposo', operator: '==', value: true }]);
}

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
