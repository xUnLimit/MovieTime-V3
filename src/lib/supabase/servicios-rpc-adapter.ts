import { assertOnlineMutation } from '@/lib/pwa/mutation-guard';
import { assertRpcStringId } from '@/lib/utils/safety';
import type { Database } from '@/lib/supabase/database.types';

import { supabase } from './client';

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

type CreateServicioWithInitialPaymentRpcClient = {
  rpc: (
    fn: 'create_servicio_with_initial_payment',
    args: CreateServicioWithInitialPaymentPayload
  ) => Promise<RpcResult>;
};

type DeleteServicioWithPaymentsRpcClient = {
  rpc: (
    fn: 'delete_servicio_with_payments',
    args: DeleteServicioWithPaymentsPayload
  ) => Promise<RpcResult>;
};

type DeleteServicioPaymentRpcClient = {
  rpc: (
    fn: 'delete_servicio_payment_and_empty_period',
    args: DeleteServicioPaymentPayload
  ) => Promise<RpcResult>;
};

export type CreateServicioWithInitialPaymentPayload = {
  p_categoria_id: string;
  p_plan_tipo_id: string | null;
  p_nombre: string;
  p_correo: string;
  p_contrasena: string;
  p_perfiles_disponibles: number;
  p_perfiles_ocupados: number;
  p_activo: boolean;
  p_en_reposo: boolean;
  p_dias_reposo: number | null;
  p_fecha_inicio_reposo: string | null;
  p_fecha_fin_reposo: string | null;
  p_notas: string | null;
  p_fecha_inicio: string;
  p_fecha_vencimiento: string;
  p_ciclo_pago: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  p_costo_original: number;
  p_moneda_original: string;
  p_costo_usd: number;
  p_exchange_rate: number | null;
  p_renovacion_automatica: boolean;
  p_metodo_pago_id: string | null;
  p_metodo_pago_nombre_snapshot: string | null;
  p_fecha_pago: string;
  p_pago_notas: string | null;
  p_created_by?: string | null;
};

export type DeleteServicioWithPaymentsPayload =
  Database['public']['Functions']['delete_servicio_with_payments']['Args'];
export type DeleteServicioPaymentPayload =
  Database['public']['Functions']['delete_servicio_payment_and_empty_period']['Args'];

const servicioInitialPaymentRpcClient =
  supabase as unknown as CreateServicioWithInitialPaymentRpcClient;
const deleteServicioWithPaymentsRpcClient =
  supabase as unknown as DeleteServicioWithPaymentsRpcClient;
const deleteServicioPaymentRpcClient = supabase as unknown as DeleteServicioPaymentRpcClient;

export async function createServicioWithInitialPaymentRpc(
  payload: CreateServicioWithInitialPaymentPayload
): Promise<string> {
  assertOnlineMutation();
  const { data, error } = await servicioInitialPaymentRpcClient.rpc(
    'create_servicio_with_initial_payment',
    payload
  );
  if (error) throw new Error(error.message);
  return assertRpcStringId(data, 'create_servicio_with_initial_payment');
}

export async function deleteServicioWithPaymentsRpc(
  payload: DeleteServicioWithPaymentsPayload
): Promise<void> {
  assertOnlineMutation();
  const { error } = await deleteServicioWithPaymentsRpcClient.rpc(
    'delete_servicio_with_payments',
    payload
  );
  if (error) throw new Error(error.message);
}

export async function deleteServicioPaymentRpc(
  payload: DeleteServicioPaymentPayload
): Promise<void> {
  assertOnlineMutation();
  const { error } = await deleteServicioPaymentRpcClient.rpc(
    'delete_servicio_payment_and_empty_period',
    payload
  );
  if (error) throw new Error(error.message);
}
