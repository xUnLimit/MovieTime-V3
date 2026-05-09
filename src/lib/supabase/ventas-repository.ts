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
import { supabase } from './client';
import { timestampToDate, toDateOnly } from './dates';
import { ENTITIES, type QueryFilter } from './entities';
import { assertRecordId, assertRpcStringId } from '@/lib/utils/safety';
import { assertOnlineMutation } from '@/lib/pwa/mutation-guard';

export { logCacheHit, adjustServiciosActivos, adjustCategoriaSuscripciones, timestampToDate };

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

const rpcClient = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
};

export const getVentas = <T>() => getAll<T>(ENTITIES.VENTAS);
export const getVentaById = <T>(id: string) => getById<T>(ENTITIES.VENTAS, id);
export const queryVentas = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.VENTAS, filters);
export const countVentas = (filters: QueryFilter[] = []) => getCount(ENTITIES.VENTAS, filters);
export const createVenta = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.VENTAS, payload);
export const updateVenta = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.VENTAS, id, payload);
export const removeVenta = (id: string) => remove(ENTITIES.VENTAS, id);

export async function removeVentaWithPayments(id: string, deletePayments: boolean): Promise<void> {
  assertOnlineMutation();
  const { error } = await rpcClient.rpc('delete_venta_with_payments', {
    p_venta_id: id,
    p_delete_payments: deletePayments,
  });
  if (error) throw new Error(error.message);
}

export async function createVentaWithInitialPayment(
  payload: Record<string, unknown>
): Promise<string> {
  assertOnlineMutation();
  const { data, error } = await rpcClient.rpc('create_venta_with_initial_payment', payload);
  if (error) throw new Error(error.message);
  return assertRpcStringId(data, 'create_venta_with_initial_payment');
}

export const getPagoVentaById = <T>(id: string) => getById<T>(ENTITIES.PAGOS_VENTA, id);
export const queryPagosVenta = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.PAGOS_VENTA, filters);
export const countPagosVenta = (filters: QueryFilter[] = []) => getCount(ENTITIES.PAGOS_VENTA, filters);
export const createPagoVenta = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.PAGOS_VENTA, payload);
export const updatePagoVenta = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.PAGOS_VENTA, id, payload);

export async function removePagoVenta(id: string): Promise<void> {
  assertOnlineMutation();
  const { error } = await rpcClient.rpc('delete_venta_payment_and_empty_period', {
    p_pago_id: id,
  });
  if (error) throw new Error(error.message);
}

export type VentaPeriodoUpdate = {
  fechaInicio: Date;
  fechaVencimiento: Date;
  cicloPago: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  precio: number;
  descuento: number;
  monto: number;
  moneda: string;
  montoUsd: number;
  exchangeRate: number | null;
};

export async function updateLatestVentaPeriodo(
  ventaId: string,
  payload: VentaPeriodoUpdate
): Promise<void> {
  assertOnlineMutation();
  const { data: latestPeriod, error: selectError } = await supabase
    .from('venta_periodos')
    .select('id')
    .eq('venta_id', ventaId)
    .order('numero_periodo', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);
  const periodoId = assertRecordId(latestPeriod, 'select latest venta_periodo');

  await updateVentaPeriodoById(periodoId, payload);
}

export async function updateVentaPeriodoById(
  periodoId: string,
  payload: VentaPeriodoUpdate
): Promise<void> {
  assertOnlineMutation();
  const { error } = await supabase
    .from('venta_periodos')
    .update({
      fecha_inicio: toDateOnly(payload.fechaInicio),
      fecha_fin: toDateOnly(payload.fechaVencimiento),
      ciclo_pago: payload.cicloPago,
      precio_original: payload.precio,
      descuento: payload.descuento,
      total_original: payload.monto,
      moneda_original: payload.moneda,
      total_usd: payload.montoUsd,
      exchange_rate: payload.exchangeRate,
    } as never)
    .eq('id', periodoId);

  if (error) throw new Error(error.message);
}

export async function updateVentaPaymentAndPeriod(
  pagoId: string,
  payload: VentaPeriodoUpdate & {
    metodoPagoId?: string | null;
    metodoPagoNombre?: string | null;
    notas?: string | null;
  }
): Promise<void> {
  assertOnlineMutation();
  const { error } = await rpcClient.rpc('update_venta_payment_and_period', {
    p_pago_id: pagoId,
    p_fecha_inicio: toDateOnly(payload.fechaInicio),
    p_fecha_fin: toDateOnly(payload.fechaVencimiento),
    p_ciclo_pago: payload.cicloPago,
    p_precio_original: payload.precio,
    p_descuento: payload.descuento,
    p_total_original: payload.monto,
    p_moneda_original: payload.moneda,
    p_total_usd: payload.montoUsd,
    p_exchange_rate: payload.exchangeRate,
    p_metodo_pago_id: payload.metodoPagoId || null,
    p_metodo_pago_nombre_snapshot: payload.metodoPagoNombre || null,
    p_pago_notas: payload.notas ?? null,
  });

  if (error) throw new Error(error.message);
}

export { ENTITIES } from './entities';
