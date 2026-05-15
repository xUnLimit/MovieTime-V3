import {
  getAll,
  getById,
  queryDocuments,
  getCount,
  create,
  update,
  remove,
  logCacheHit,
  adjustServiciosActivos,
} from './record-core';
import { ENTITIES, type QueryFilter } from './entities';

export { logCacheHit, adjustServiciosActivos };

export const getTerceros = <T>() => getAll<T>(ENTITIES.TERCEROS);
export const getTerceroById = <T>(id: string) => getById<T>(ENTITIES.TERCEROS, id);
export const queryTerceros = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.TERCEROS, filters);
export const countTerceros = (filters: QueryFilter[] = []) => getCount(ENTITIES.TERCEROS, filters);
export const createTercero = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.TERCEROS, payload);
export const updateTercero = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.TERCEROS, id, payload);
export const removeTercero = (id: string) => remove(ENTITIES.TERCEROS, id);

export { ENTITIES } from './entities';
