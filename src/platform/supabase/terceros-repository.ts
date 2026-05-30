import {
  getAll,
  getById,
  queryDocuments,
  getCount,
  countFromView,
  create,
  update,
  remove,
  logCacheHit,
} from './record-core';
import { ENTITIES, type QueryFilter } from './entities';

export { logCacheHit };

export const getTerceros = <T>() => getAll<T>(ENTITIES.TERCEROS);
export const getTerceroById = <T>(id: string) => getById<T>(ENTITIES.TERCEROS, id);
export const queryTerceros = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.TERCEROS, filters);

// Contar por servicios activos requiere la vista derivada; el resto usa el conteo generico.
export const countTerceros = (filters: QueryFilter[] = []) =>
  filters.some((filter) => filter.field === 'serviciosActivos')
    ? countFromView(ENTITIES.TERCEROS, 'v_terceros_servicios_activos', filters, {
        serviciosActivos: 'servicios_activos',
      })
    : getCount(ENTITIES.TERCEROS, filters);
export const createTercero = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.TERCEROS, payload);
export const updateTercero = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.TERCEROS, id, payload);
export const removeTercero = (id: string) => remove(ENTITIES.TERCEROS, id);

export { ENTITIES } from './entities';
