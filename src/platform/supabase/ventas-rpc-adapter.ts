import { assertOnlineMutation } from '@/modules/pwa/offline-copy';
import type { Database } from '@/platform/supabase/database.types';

import { executeIdempotentRpc } from './idempotent-rpc';
import { typedRpcClient, type RpcResult } from './rpc-client';

type CreateVentaWithInitialPaymentRpcClient = {
  rpc: (
    fn: 'create_venta_with_initial_payment',
    args: CreateVentaWithInitialPaymentPayload
  ) => Promise<RpcResult>;
};

type CreateVentaRefundRpcClient = {
  rpc: (
    fn: 'create_venta_refund',
    args: CreateVentaRefundPayload
  ) => Promise<RpcResult>;
};

type DeleteVentaWithPaymentsRpcClient = {
  rpc: (
    fn: 'delete_venta_with_payments',
    args: DeleteVentaWithPaymentsPayload
  ) => Promise<RpcResult>;
};

type DeleteVentaPaymentRpcClient = {
  rpc: (
    fn: 'delete_venta_payment_and_empty_period',
    args: DeleteVentaPaymentPayload
  ) => Promise<RpcResult>;
};

type UpdateVentaPaymentAndPeriodRpcClient = {
  rpc: (
    fn: 'update_venta_payment_and_period',
    args: UpdateVentaPaymentAndPeriodPayload
  ) => Promise<RpcResult>;
};

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

const ventaInitialPaymentRpcClient = typedRpcClient<CreateVentaWithInitialPaymentRpcClient>();
const ventaRefundRpcClient = typedRpcClient<CreateVentaRefundRpcClient>();
const deleteVentaWithPaymentsRpcClient = typedRpcClient<DeleteVentaWithPaymentsRpcClient>();
const deleteVentaPaymentRpcClient = typedRpcClient<DeleteVentaPaymentRpcClient>();
const updateVentaPaymentAndPeriodRpcClient =
  typedRpcClient<UpdateVentaPaymentAndPeriodRpcClient>();

export async function createVentaWithInitialPaymentRpc(
  payload: CreateVentaWithInitialPaymentPayload
): Promise<string> {
  assertOnlineMutation();
  return executeIdempotentRpc('create_venta_with_initial_payment', payload, (request) =>
    ventaInitialPaymentRpcClient.rpc('create_venta_with_initial_payment', request));
}

export async function createVentaRefundRpc(payload: CreateVentaRefundPayload): Promise<string> {
  assertOnlineMutation();
  return executeIdempotentRpc('create_venta_refund', payload, (request) =>
    ventaRefundRpcClient.rpc('create_venta_refund', request));
}

export async function deleteVentaWithPaymentsRpc(
  payload: DeleteVentaWithPaymentsPayload
): Promise<void> {
  assertOnlineMutation();
  const { error } = await deleteVentaWithPaymentsRpcClient.rpc('delete_venta_with_payments', payload);
  if (error) throw new Error(error.message);
}

export async function deleteVentaPaymentRpc(payload: DeleteVentaPaymentPayload): Promise<void> {
  assertOnlineMutation();
  const { error } = await deleteVentaPaymentRpcClient.rpc(
    'delete_venta_payment_and_empty_period',
    payload
  );
  if (error) throw new Error(error.message);
}

export async function updateVentaPaymentAndPeriodRpc(
  payload: UpdateVentaPaymentAndPeriodPayload
): Promise<void> {
  assertOnlineMutation();
  const { error } = await updateVentaPaymentAndPeriodRpcClient.rpc(
    'update_venta_payment_and_period',
    payload
  );
  if (error) throw new Error(error.message);
}
