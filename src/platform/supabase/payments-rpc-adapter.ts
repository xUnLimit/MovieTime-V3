import { executeIdempotentRpc } from './idempotent-rpc';
import { callRpc } from './rpc-client';

export type CreateServicioPaymentPayload = {
  p_servicio_id: string;
  p_categoria_id_snapshot: string | null;
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

export type CreateVentaPaymentPayload = {
  p_venta_id: string;
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
  p_plan_id: string | null;
  p_plan_nombre_snapshot: string | null;
  p_plan_tipo_nombre_snapshot: string | null;
  p_idempotency_key?: string | null;
};

export async function createServicioPaymentRpc(
  payload: CreateServicioPaymentPayload
): Promise<string> {
  return executeIdempotentRpc('create_servicio_payment', payload, (request) =>
    callRpc('create_servicio_payment', request));
}

export async function createVentaPaymentRpc(payload: CreateVentaPaymentPayload): Promise<string> {
  return executeIdempotentRpc('create_venta_payment', payload, (request) =>
    callRpc('create_venta_payment', request));
}
