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

export const getUsuarios = <T>() => getAll<T>(ENTITIES.USUARIOS);
export const getUsuarioById = <T>(id: string) => getById<T>(ENTITIES.USUARIOS, id);
export const queryUsuarios = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.USUARIOS, filters);
export const countUsuarios = (filters: QueryFilter[] = []) => getCount(ENTITIES.USUARIOS, filters);
export const createUsuario = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.USUARIOS, payload);
export const updateUsuario = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.USUARIOS, id, payload);
export const removeUsuario = (id: string) => remove(ENTITIES.USUARIOS, id);

export { ENTITIES } from './entities';
