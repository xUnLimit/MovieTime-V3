import { getById, queryDocuments, getCount, create, update, archiveRecord } from './record-core';
import { supabase } from './client';
import { timestampToDate, toDateOnly } from './dates';
import { ENTITIES, type QueryFilter } from './entities';
import { assertRecordId } from '@/platform/utils/safety';
import {
  createPagoVenta as createPagoVentaRecord,
  type CreatePagoVentaInput,
} from './payments-repository';
import {
  createVentaRefundRpc,
  createVentaWithInitialPaymentRpc,
  deleteVentaPaymentRpc,
  deleteVentaWithPaymentsRpc,
  updateVentaPaymentAndPeriodRpc,
  type CreateVentaRefundPayload,
  type CreateVentaWithInitialPaymentPayload,
} from './ventas-rpc-adapter';

export { timestampToDate };
export const getVentaById = <T>(id: string) => getById<T>(ENTITIES.VENTAS, id);
export const queryVentas = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.VENTAS, filters);
export const countVentas = (filters: QueryFilter[] = []) => getCount(ENTITIES.VENTAS, filters);
export const createVenta = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.VENTAS, payload);
export const updateVenta = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.VENTAS, id, payload);
// Una renovacion cancela la respuesta "no continuar" del ciclo anterior: el cliente pago.
export async function clearVentaCustomerResponse(id: string): Promise<void> {
  const { error } = await supabase.from('ventas').update({ respuesta_cliente: null, respuesta_cliente_at: null }).eq('id', id);
  if (error) throw new Error(error.message);
}
// Politica de persistencia del agregado venta: se archiva (soft-delete), no se borra.
export const removeVenta = (id: string) => archiveRecord(ENTITIES.VENTAS, id);

export async function removeVentaWithPayments(id: string, deletePayments: boolean): Promise<void> {
  await deleteVentaWithPaymentsRpc({
    p_venta_id: id,
    p_delete_payments: deletePayments,
  });
}

export async function createVentaWithInitialPayment(
  payload: CreateVentaWithInitialPaymentPayload
): Promise<string> {
  return createVentaWithInitialPaymentRpc(payload);
}

export async function createVentaRefund(payload: CreateVentaRefundPayload): Promise<string> {
  return createVentaRefundRpc(payload);
}

export const getPagoVentaById = <T>(id: string) => getById<T>(ENTITIES.PAGOS_VENTA, id);
export const queryPagosVenta = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.PAGOS_VENTA, filters);
export const createPagoVenta = (payload: CreatePagoVentaInput) =>
  createPagoVentaRecord(payload);

export async function removePagoVenta(id: string): Promise<void> {
  await deleteVentaPaymentRpc({
    p_pago_id: id,
  });
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
  planId?: string | null;
  planNombre?: string | null;
  planTipoNombre?: string | null;
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
  const periodoId = assertRecordId(latestPeriod, 'select latest venta_periodo');

  await updateVentaPeriodoById(periodoId, payload);
}

export async function updateVentaPeriodoById(
  periodoId: string,
  payload: VentaPeriodoUpdate
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    fecha_inicio: toDateOnly(payload.fechaInicio),
    fecha_fin: toDateOnly(payload.fechaVencimiento),
    ciclo_pago: payload.cicloPago,
    precio_original: payload.precio,
    descuento: payload.descuento,
    total_original: payload.monto,
    moneda_original: payload.moneda,
    total_usd: payload.montoUsd,
    exchange_rate: payload.exchangeRate,
  };

  if (payload.planId !== undefined) {
    updatePayload.plan_id = payload.planId || null;
    updatePayload.plan_nombre_snapshot = payload.planNombre ?? '';
    updatePayload.plan_tipo_nombre_snapshot = payload.planTipoNombre ?? '';
  }

  const { error } = await supabase
    .from('venta_periodos')
    .update(updatePayload as never)
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
  await updateVentaPaymentAndPeriodRpc({
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

  if (payload.planId !== undefined) {
    const { data: pago, error: selectError } = await supabase
      .from('pagos_venta')
      .select('venta_periodo_id')
      .eq('id', pagoId)
      .maybeSingle();

    if (selectError) throw new Error(selectError.message);
    const periodoId = getVentaPeriodoIdFromPago(pago);

    const { error: planError } = await supabase
      .from('venta_periodos')
      .update({
        plan_id: payload.planId || null,
        plan_nombre_snapshot: payload.planNombre ?? '',
        plan_tipo_nombre_snapshot: payload.planTipoNombre ?? '',
      } as never)
      .eq('id', periodoId);

    if (planError) throw new Error(planError.message);
  }
}

function getVentaPeriodoIdFromPago(pago: unknown): string {
  if (!pago || typeof pago !== 'object' || !('venta_periodo_id' in pago)) {
    throw new Error('select venta_periodo for pago_venta no retorno un registro con venta_periodo_id');
  }

  const periodoId = (pago as { venta_periodo_id?: unknown }).venta_periodo_id;
  if (typeof periodoId !== 'string' || periodoId.trim() === '') {
    throw new Error('select venta_periodo for pago_venta retorno un venta_periodo_id invalido');
  }

  return periodoId;
}

