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

export async function createVentaWithInitialPayment(
  payload: Record<string, unknown>
): Promise<string> {
  const { data, error } = await rpcClient.rpc('create_venta_with_initial_payment', payload);
  if (error) throw new Error(error.message);
  return String(data);
}

export const getPagoVentaById = <T>(id: string) => getById<T>(ENTITIES.PAGOS_VENTA, id);
export const queryPagosVenta = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.PAGOS_VENTA, filters);
export const countPagosVenta = (filters: QueryFilter[] = []) => getCount(ENTITIES.PAGOS_VENTA, filters);
export const createPagoVenta = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.PAGOS_VENTA, payload);
export const updatePagoVenta = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.PAGOS_VENTA, id, payload);

export async function removePagoVenta(id: string): Promise<void> {
  const { data: pago, error: selectError } = await supabase
    .from('pagos_venta')
    .select('venta_periodo_id')
    .eq('id', id)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);

  await remove(ENTITIES.PAGOS_VENTA, id);

  const periodoId = (pago as { venta_periodo_id?: string } | null)?.venta_periodo_id;
  if (!periodoId) return;

  const { count, error: countError } = await supabase
    .from('pagos_venta')
    .select('*', { count: 'exact', head: true })
    .eq('venta_periodo_id', periodoId);

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) return;

  const { error: deleteError } = await supabase
    .from('venta_periodos')
    .delete()
    .eq('id', periodoId);

  if (deleteError) throw new Error(deleteError.message);
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
  const { data: latestPeriod, error: selectError } = await supabase
    .from('venta_periodos')
    .select('id')
    .eq('venta_id', ventaId)
    .order('numero_periodo', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);
  if (!latestPeriod) return;

  await updateVentaPeriodoById((latestPeriod as { id: string }).id, payload);
}

export async function updateVentaPeriodoById(
  periodoId: string,
  payload: VentaPeriodoUpdate
): Promise<void> {
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

export { ENTITIES } from './entities';
