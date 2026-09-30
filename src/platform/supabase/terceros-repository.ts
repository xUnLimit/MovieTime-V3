import { getAll, getById, getCount, countFromView, create, update, remove } from './record-core';
import { ENTITIES, type QueryFilter } from './entities';

export const getTerceros = <T>() => getAll<T>(ENTITIES.TERCEROS);
export const getTerceroById = <T>(id: string) => getById<T>(ENTITIES.TERCEROS, id);

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

