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
import { supabase } from './client';
import { toDateOnly } from './dates';
import { ENTITIES, type QueryFilter } from './entities';

export { logCacheHit, adjustCategoriaGastos };

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

const rpcClient = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
};

export const getServicios = <T>() => getAll<T>(ENTITIES.SERVICIOS);
export const getServicioById = <T>(id: string) => getById<T>(ENTITIES.SERVICIOS, id);
export const queryServicios = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.SERVICIOS, filters);
export const countServicios = (filters: QueryFilter[] = []) => getCount(ENTITIES.SERVICIOS, filters);
export const createServicio = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.SERVICIOS, payload);
export const updateServicio = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.SERVICIOS, id, payload);
export const removeServicio = (id: string) => remove(ENTITIES.SERVICIOS, id);

export async function createServicioWithInitialPayment(
  payload: Record<string, unknown>
): Promise<string> {
  const { data, error } = await rpcClient.rpc('create_servicio_with_initial_payment', payload);
  if (error) throw new Error(error.message);
  return String(data);
}

export const queryPagosServicio = <T>(filters: QueryFilter[] = []) =>
  queryDocuments<T>(ENTITIES.PAGOS_SERVICIO, filters);
export const getPagoServicioById = <T>(id: string) => getById<T>(ENTITIES.PAGOS_SERVICIO, id);
export const updatePagoServicio = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.PAGOS_SERVICIO, id, payload);

export async function removePagoServicio(id: string): Promise<void> {
  const { data: pago, error: selectError } = await supabase
    .from('pagos_servicio')
    .select('servicio_periodo_id')
    .eq('id', id)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);

  await remove(ENTITIES.PAGOS_SERVICIO, id);

  const periodoId = (pago as { servicio_periodo_id?: string } | null)?.servicio_periodo_id;
  if (!periodoId) return;

  const { count, error: countError } = await supabase
    .from('pagos_servicio')
    .select('*', { count: 'exact', head: true })
    .eq('servicio_periodo_id', periodoId);

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) return;

  const { error: deleteError } = await supabase
    .from('servicio_periodos')
    .delete()
    .eq('id', periodoId);

  if (deleteError) throw new Error(deleteError.message);
}

export type ServicioPeriodoUpdate = {
  fechaInicio: Date;
  fechaVencimiento: Date;
  cicloPago: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  costo: number;
  moneda: string;
  costoUsd: number;
  exchangeRate: number | null;
  renovacionAutomatica?: boolean;
};

export async function updateLatestServicioPeriodo(
  servicioId: string,
  payload: ServicioPeriodoUpdate
): Promise<void> {
  const { data: latestPeriod, error: selectError } = await supabase
    .from('servicio_periodos')
    .select('id')
    .eq('servicio_id', servicioId)
    .order('numero_periodo', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);
  if (!latestPeriod) return;

  await updateServicioPeriodoById((latestPeriod as { id: string }).id, payload);
}

export async function updateServicioPeriodoById(
  periodoId: string,
  payload: ServicioPeriodoUpdate
): Promise<void> {
  const periodUpdate: Record<string, unknown> = {
    fecha_inicio: toDateOnly(payload.fechaInicio),
    fecha_vencimiento: toDateOnly(payload.fechaVencimiento),
    ciclo_pago: payload.cicloPago,
    costo_original: payload.costo,
    moneda_original: payload.moneda,
    costo_usd: payload.costoUsd,
    exchange_rate: payload.exchangeRate,
  };

  if (payload.renovacionAutomatica !== undefined) {
    periodUpdate.renovacion_automatica = payload.renovacionAutomatica;
  }

  const { error } = await supabase
    .from('servicio_periodos')
    .update(periodUpdate as never)
    .eq('id', periodoId);

  if (error) throw new Error(error.message);
}

export { ENTITIES } from './entities';
