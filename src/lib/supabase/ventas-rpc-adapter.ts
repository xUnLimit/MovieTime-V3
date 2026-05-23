import { assertOnlineMutation } from '@/lib/pwa/mutation-guard';
import { assertRpcStringId } from '@/lib/utils/safety';
import type { Database } from '@/lib/supabase/database.types';

import { supabase } from './client';

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

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
  p_created_by?: string | null;
};

export type CreateVentaRefundPayload =
  Database['public']['Functions']['create_venta_refund']['Args'];
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
};

const ventaInitialPaymentRpcClient = supabase as unknown as CreateVentaWithInitialPaymentRpcClient;
const ventaRefundRpcClient = supabase as unknown as CreateVentaRefundRpcClient;
const deleteVentaWithPaymentsRpcClient = supabase as unknown as DeleteVentaWithPaymentsRpcClient;
const deleteVentaPaymentRpcClient = supabase as unknown as DeleteVentaPaymentRpcClient;
const updateVentaPaymentAndPeriodRpcClient =
  supabase as unknown as UpdateVentaPaymentAndPeriodRpcClient;

export async function createVentaWithInitialPaymentRpc(
  payload: CreateVentaWithInitialPaymentPayload
): Promise<string> {
  assertOnlineMutation();
  const { data, error } = await ventaInitialPaymentRpcClient.rpc(
    'create_venta_with_initial_payment',
    payload
  );
  if (error) throw new Error(error.message);
  return assertRpcStringId(data, 'create_venta_with_initial_payment');
}

export async function createVentaRefundRpc(payload: CreateVentaRefundPayload): Promise<string> {
  assertOnlineMutation();
  const { data, error } = await ventaRefundRpcClient.rpc('create_venta_refund', payload);
  if (error) throw new Error(error.message);
  return assertRpcStringId(data, 'create_venta_refund');
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
