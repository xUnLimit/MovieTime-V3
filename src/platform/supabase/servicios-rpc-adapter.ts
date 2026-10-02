import type { Database } from '@/platform/supabase/database.types';

import { executeIdempotentRpc } from './idempotent-rpc';
import { assertRpcVoidResult, callRpc } from './rpc-client';

export type CreateServicioWithInitialPaymentPayload = {
  p_acceso_por_codigo?: boolean;
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
  p_idempotency_key?: string | null;
};

export type DeleteServicioWithPaymentsPayload =
  Database['public']['Functions']['delete_servicio_with_payments']['Args'];
export type DeleteServicioPaymentPayload =
  Database['public']['Functions']['delete_servicio_payment_and_empty_period']['Args'];
export type UpdateServicioPaymentAndPeriodPayload = {
  p_pago_id: string;
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
  p_pago_notas: string | null;
};

export async function createServicioWithInitialPaymentRpc(
  payload: CreateServicioWithInitialPaymentPayload
): Promise<string> {
  if (payload.p_acceso_por_codigo === true) {
    const request = { ...payload, p_acceso_por_codigo: true };
    return executeIdempotentRpc('create_servicio_with_code_access', request, (args) =>
      callRpc('create_servicio_with_code_access', args));
  }
  const legacyPayload = { ...payload };
  delete legacyPayload.p_acceso_por_codigo;
  return executeIdempotentRpc('create_servicio_with_initial_payment', legacyPayload, (request) =>
    callRpc('create_servicio_with_initial_payment', request));
}

export async function deleteServicioWithPaymentsRpc(
  payload: DeleteServicioWithPaymentsPayload
): Promise<void> {
  const { data, error } = await callRpc('delete_servicio_with_payments', payload);
  if (error) throw new Error(error.message);
  assertRpcVoidResult(data, 'delete_servicio_with_payments');
}

export async function deleteServicioPaymentRpc(
  payload: DeleteServicioPaymentPayload
): Promise<void> {
  const { data, error } = await callRpc('delete_servicio_payment_and_empty_period', payload);
  if (error) throw new Error(error.message);
  assertRpcVoidResult(data, 'delete_servicio_payment_and_empty_period');
}

export async function updateServicioPaymentAndPeriodRpc(
  payload: UpdateServicioPaymentAndPeriodPayload
): Promise<void> {
  const { data, error } = await callRpc('update_servicio_payment_and_period', payload);
  if (error) throw new Error(error.message);
  assertRpcVoidResult(data, 'update_servicio_payment_and_period');
}
