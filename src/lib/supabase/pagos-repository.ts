import { getById, queryDocuments, getCount, create, update, remove, logCacheHit } from './record-core';
import { ENTITIES, type QueryFilter } from './entities';

export { logCacheHit };

export const getPagoVentaById = <T>(id: string) => getById<T>(ENTITIES.PAGOS_VENTA, id);
export const queryPagosVenta = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.PAGOS_VENTA, filters);
export const countPagosVenta = (filters: QueryFilter[] = []) => getCount(ENTITIES.PAGOS_VENTA, filters);
export const createPagoVenta = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.PAGOS_VENTA, payload);
export const updatePagoVenta = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.PAGOS_VENTA, id, payload);
export const removePagoVenta = (id: string) => remove(ENTITIES.PAGOS_VENTA, id);

export const getPagoServicioById = <T>(id: string) => getById<T>(ENTITIES.PAGOS_SERVICIO, id);
export const queryPagosServicio = <T>(filters: QueryFilter[] = []) =>
  queryDocuments<T>(ENTITIES.PAGOS_SERVICIO, filters);
export const countPagosServicio = (filters: QueryFilter[] = []) => getCount(ENTITIES.PAGOS_SERVICIO, filters);
export const createPagoServicio = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.PAGOS_SERVICIO, payload);
export const updatePagoServicio = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.PAGOS_SERVICIO, id, payload);
export const removePagoServicio = (id: string) => remove(ENTITIES.PAGOS_SERVICIO, id);

export { ENTITIES } from './entities';
