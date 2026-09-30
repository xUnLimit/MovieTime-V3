import { queryDocuments } from './record-core';
import { ENTITIES, type QueryFilter } from './entities';
import {
  createPagoServicio as createPagoServicioRecord,
  createPagoVenta as createPagoVentaRecord,
  type CreatePagoServicioInput,
  type CreatePagoVentaInput,
} from './payments-repository';
import { removePagoServicio as removePagoServicioWithPeriodo } from './servicios-repository';
import { removePagoVenta as removePagoVentaWithPeriodo } from './ventas-repository';
export const createPagoVenta = (payload: CreatePagoVentaInput) =>
  createPagoVentaRecord(payload);
export const removePagoVenta = removePagoVentaWithPeriodo;
export const queryPagosServicio = <T>(filters: QueryFilter[] = []) =>
  queryDocuments<T>(ENTITIES.PAGOS_SERVICIO, filters);
export const createPagoServicio = (payload: CreatePagoServicioInput) =>
  createPagoServicioRecord(payload);
export const removePagoServicio = removePagoServicioWithPeriodo;

