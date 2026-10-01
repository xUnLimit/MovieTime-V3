import type { Database } from '@/platform/supabase/database.types';

import { executeIdempotentRpc } from './idempotent-rpc';
import { assertRpcVoidResult, callRpc } from './rpc-client';

export type CreateVentaWithInitialPaymentPayload = {
  p_cliente_id: string | null;
  p_servicio_id: string;
  p_categoria_id: string;
  p_estado: 'activo' | 'inactivo';
  p_perfil_numero: number | null;
  p_perfil_nombre: string | null;
  p_codigo: string | null;
  p_notas: string | null;
  p_fecha_inicio: string;
  p_fecha_fin: string;
  p_ciclo_pago: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  p_precio_original: number;
  p_descuento: number;
  p_total_original: number;
  p_moneda_original: string;
  p_total_usd: number;
  p_exchange_rate: number | null;
  p_metodo_pago_id: string | null;
  p_metodo_pago_nombre_snapshot: string | null;
  p_fecha_pago: string;
  p_pago_notas: string | null;
  p_plan_id: string | null | undefined;
  p_plan_nombre_snapshot: string | null | undefined;
  p_plan_tipo_nombre_snapshot: string | null | undefined;
  p_idempotency_key?: string | null;
};

export type CreateVentaRefundPayload =
  Omit<
    Database['public']['Functions']['create_venta_refund']['Args'],
    'p_created_by' | 'p_metodo_pago_id' | 'p_metodo_pago_nombre_snapshot' | 'p_nota' | 'p_motivo_corte'
  > & {
    p_metodo_pago_id: string | null;
    p_metodo_pago_nombre_snapshot: string | null;
    p_nota?: string | null;
    p_motivo_corte?: string | null;
    p_idempotency_key?: string | null;
  };
export type DeleteVentaWithPaymentsPayload =
  Database['public']['Functions']['delete_venta_with_payments']['Args'];
export type DeleteVentaPaymentPayload =
  Database['public']['Functions']['delete_venta_payment_and_empty_period']['Args'];
export type UpdateVentaPaymentAndPeriodPayload = {
  p_pago_id: string;
  p_fecha_inicio: string;
  p_fecha_fin: string;
  p_ciclo_pago: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  p_precio_original: number;
  p_descuento: number;
  p_total_original: number;
  p_moneda_original: string;
  p_total_usd: number;
  p_exchange_rate: number | null;
  p_metodo_pago_id: string | null;
  p_metodo_pago_nombre_snapshot: string | null;
  p_pago_notas: string | null;
  p_idempotency_key?: string | null;
};

export async function createVentaWithInitialPaymentRpc(
  payload: CreateVentaWithInitialPaymentPayload
): Promise<string> {
  return executeIdempotentRpc('create_venta_with_initial_payment', payload, (request) =>
    callRpc('create_venta_with_initial_payment', request));
}

export async function createVentaRefundRpc(payload: CreateVentaRefundPayload): Promise<string> {
  return executeIdempotentRpc('create_venta_refund', payload, (request) =>
    callRpc('create_venta_refund', request));
}

export async function deleteVentaWithPaymentsRpc(
  payload: DeleteVentaWithPaymentsPayload
): Promise<void> {
  const { data, error } = await callRpc('delete_venta_with_payments', payload);
  if (error) throw new Error(error.message);
  assertRpcVoidResult(data, 'delete_venta_with_payments');
}

export async function deleteVentaPaymentRpc(payload: DeleteVentaPaymentPayload): Promise<void> {
  const { data, error } = await callRpc('delete_venta_payment_and_empty_period', payload);
  if (error) throw new Error(error.message);
  assertRpcVoidResult(data, 'delete_venta_payment_and_empty_period');
}

export async function updateVentaPaymentAndPeriodRpc(
  payload: UpdateVentaPaymentAndPeriodPayload
): Promise<void> {
  const { data, error } = await callRpc('update_venta_payment_and_period', payload);
  if (error) throw new Error(error.message);
  assertRpcVoidResult(data, 'update_venta_payment_and_period');
}
