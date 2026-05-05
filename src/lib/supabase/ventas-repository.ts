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
  adjustCategoriaSuscripciones,
} from './record-core';
import { timestampToDate } from './dates';
import { ENTITIES, type QueryFilter } from './entities';

export { logCacheHit, adjustServiciosActivos, adjustCategoriaSuscripciones, timestampToDate };

export const getVentas = <T>() => getAll<T>(ENTITIES.VENTAS);
export const getVentaById = <T>(id: string) => getById<T>(ENTITIES.VENTAS, id);
export const queryVentas = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.VENTAS, filters);
export const countVentas = (filters: QueryFilter[] = []) => getCount(ENTITIES.VENTAS, filters);
export const createVenta = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.VENTAS, payload);
export const updateVenta = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.VENTAS, id, payload);
export const removeVenta = (id: string) => remove(ENTITIES.VENTAS, id);

export const getPagoVentaById = <T>(id: string) => getById<T>(ENTITIES.PAGOS_VENTA, id);
export const queryPagosVenta = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.PAGOS_VENTA, filters);
export const countPagosVenta = (filters: QueryFilter[] = []) => getCount(ENTITIES.PAGOS_VENTA, filters);
export const createPagoVenta = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.PAGOS_VENTA, payload);
export const updatePagoVenta = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.PAGOS_VENTA, id, payload);
export const removePagoVenta = (id: string) => remove(ENTITIES.PAGOS_VENTA, id);

export { ENTITIES } from './entities';
