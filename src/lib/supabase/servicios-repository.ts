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
} from './record-core';
import { ENTITIES, type QueryFilter } from './entities';

export { logCacheHit, adjustCategoriaGastos };

export const getServicios = <T>() => getAll<T>(ENTITIES.SERVICIOS);
export const getServicioById = <T>(id: string) => getById<T>(ENTITIES.SERVICIOS, id);
export const queryServicios = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.SERVICIOS, filters);
export const countServicios = (filters: QueryFilter[] = []) => getCount(ENTITIES.SERVICIOS, filters);
export const createServicio = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.SERVICIOS, payload);
export const updateServicio = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.SERVICIOS, id, payload);
export const removeServicio = (id: string) => remove(ENTITIES.SERVICIOS, id);

export const queryPagosServicio = <T>(filters: QueryFilter[] = []) =>
  queryDocuments<T>(ENTITIES.PAGOS_SERVICIO, filters);
export const updatePagoServicio = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.PAGOS_SERVICIO, id, payload);
export const removePagoServicio = (id: string) => remove(ENTITIES.PAGOS_SERVICIO, id);

export { ENTITIES } from './entities';
