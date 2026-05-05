import {
  getAll,
  getById,
  queryDocuments,
  getCount,
  create,
  update,
  remove,
  logCacheHit,
  adjustCategoriaGastos,
  adjustCategoriaSuscripciones,
} from './record-core';
import { ENTITIES, type QueryFilter } from './entities';

export { logCacheHit, adjustCategoriaGastos, adjustCategoriaSuscripciones };

export const getCategorias = <T>() => getAll<T>(ENTITIES.CATEGORIAS);
export const getCategoriaById = <T>(id: string) => getById<T>(ENTITIES.CATEGORIAS, id);
export const queryCategorias = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.CATEGORIAS, filters);
export const countCategorias = (filters: QueryFilter[] = []) => getCount(ENTITIES.CATEGORIAS, filters);
export const createCategoria = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.CATEGORIAS, payload);
export const updateCategoria = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.CATEGORIAS, id, payload);
export const removeCategoria = (id: string) => remove(ENTITIES.CATEGORIAS, id);

export { ENTITIES } from './entities';
