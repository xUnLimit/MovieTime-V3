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

const ventaInitialPaymentRpcClient = supabase as unknown as CreateVentaWithInitialPaymentRpcClient;
const ventaRefundRpcClient = supabase as unknown as CreateVentaRefundRpcClient;

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
