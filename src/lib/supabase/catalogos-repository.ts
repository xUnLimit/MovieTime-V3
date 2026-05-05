import { getAll, getById, queryDocuments, getCount, create, update, remove, logCacheHit } from './record-core';
import { ENTITIES, type QueryFilter } from './entities';

export { logCacheHit };

export const getMetodosPago = <T>() => getAll<T>(ENTITIES.METODOS_PAGO);
export const getMetodoPagoById = <T>(id: string) => getById<T>(ENTITIES.METODOS_PAGO, id);
export const queryMetodosPago = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.METODOS_PAGO, filters);
export const countMetodosPago = (filters: QueryFilter[] = []) => getCount(ENTITIES.METODOS_PAGO, filters);
export const createMetodoPago = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.METODOS_PAGO, payload);
export const updateMetodoPago = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.METODOS_PAGO, id, payload);
export const removeMetodoPago = (id: string) => remove(ENTITIES.METODOS_PAGO, id);

export const getTiposGasto = <T>() => getAll<T>(ENTITIES.TIPOS_GASTO);
export const getTipoGastoById = <T>(id: string) => getById<T>(ENTITIES.TIPOS_GASTO, id);
export const queryTiposGasto = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.TIPOS_GASTO, filters);
export const countTiposGasto = (filters: QueryFilter[] = []) => getCount(ENTITIES.TIPOS_GASTO, filters);
export const createTipoGasto = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.TIPOS_GASTO, payload);
export const updateTipoGasto = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.TIPOS_GASTO, id, payload);

export const getGastos = <T>() => getAll<T>(ENTITIES.GASTOS);
export const getGastoById = <T>(id: string) => getById<T>(ENTITIES.GASTOS, id);
export const queryGastos = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.GASTOS, filters);
export const createGasto = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.GASTOS, payload);
export const updateGasto = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.GASTOS, id, payload);
export const removeGasto = (id: string) => remove(ENTITIES.GASTOS, id);

export { ENTITIES } from './entities';
