import { getById, queryDocuments, getCount, update, logCacheHit } from './record-core';
import { ENTITIES, type QueryFilter } from './entities';
import {
  createPagoServicio as createPagoServicioRecord,
  createPagoVenta as createPagoVentaRecord,
  type CreatePagoServicioInput,
  type CreatePagoVentaInput,
} from './payments-repository';
import { removePagoServicio as removePagoServicioWithPeriodo } from './servicios-repository';
import { removePagoVenta as removePagoVentaWithPeriodo } from './ventas-repository';

export { logCacheHit };

// Los pagos se crean con su forma dedicada (createPago*Record en payments-repository);
// las lecturas/conteos/updates simples reusan el motor generico del core.
export const getPagoVentaById = <T>(id: string) => getById<T>(ENTITIES.PAGOS_VENTA, id);
export const queryPagosVenta = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.PAGOS_VENTA, filters);
export const countPagosVenta = (filters: QueryFilter[] = []) => getCount(ENTITIES.PAGOS_VENTA, filters);
export const createPagoVenta = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  createPagoVentaRecord(payload as unknown as CreatePagoVentaInput);
export const updatePagoVenta = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.PAGOS_VENTA, id, payload);
export const removePagoVenta = removePagoVentaWithPeriodo;

export const getPagoServicioById = <T>(id: string) => getById<T>(ENTITIES.PAGOS_SERVICIO, id);
export const queryPagosServicio = <T>(filters: QueryFilter[] = []) =>
  queryDocuments<T>(ENTITIES.PAGOS_SERVICIO, filters);
export const countPagosServicio = (filters: QueryFilter[] = []) => getCount(ENTITIES.PAGOS_SERVICIO, filters);
export const createPagoServicio = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  createPagoServicioRecord(payload as unknown as CreatePagoServicioInput);
export const updatePagoServicio = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.PAGOS_SERVICIO, id, payload);
export const removePagoServicio = removePagoServicioWithPeriodo;

export { ENTITIES } from './entities';
