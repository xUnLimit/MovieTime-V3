import { supabase } from './client';
import { toDateOnly, toIso } from './dates';
import { assertRpcStringId } from '@/lib/utils/safety';
import { assertOnlineMutation } from '@/lib/pwa/mutation-guard';

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

const rpcClient = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
};

export async function createPagoServicio(payload: Record<string, unknown>): Promise<string> {
  assertOnlineMutation();
  const servicioId = String(payload.servicioId ?? '');
  if (!servicioId) throw new Error('servicioId es requerido para pagos_servicio');

  const monto = Number(payload.monto ?? 0);
  const moneda = String(payload.moneda ?? 'USD');
  const { usd, rate } = await convertAmountToUSD(monto, moneda);

  const { data, error } = await rpcClient.rpc('create_servicio_payment', {
    p_servicio_id: servicioId,
    p_categoria_id_snapshot: payload.categoriaId || null,
    p_fecha_inicio: toDateOnly(payload.fechaInicio ?? new Date()),
    p_fecha_vencimiento: toDateOnly(payload.fechaVencimiento ?? new Date()),
    p_ciclo_pago: payload.cicloPago ?? 'mensual',
    p_costo_original: monto,
    p_moneda_original: moneda,
    p_costo_usd: usd,
    p_exchange_rate: rate,
    p_renovacion_automatica: Boolean(payload.renovacionAutomatica ?? false),
    p_metodo_pago_id: payload.metodoPagoId || null,
    p_metodo_pago_nombre_snapshot: payload.metodoPagoNombre || null,
    p_fecha_pago: toIso(payload.fecha ?? new Date()),
    p_pago_notas: payload.notas ?? null,
  });

  if (error) throw new Error(error.message);
  return assertRpcStringId(data, 'create_servicio_payment');
}

export async function createPagoVenta(payload: Record<string, unknown>): Promise<string> {
  assertOnlineMutation();
  const ventaId = String(payload.ventaId ?? '');
  if (!ventaId) throw new Error('ventaId es requerido para pagos_venta');

  const monto = Number(payload.monto ?? 0);
  const precio = Number(payload.precio ?? monto);
  const descuento = Number(payload.descuento ?? 0);
  const moneda = String(payload.moneda ?? 'USD');
  const { usd, rate } = await convertAmountToUSD(monto, moneda);

  const { data, error } = await rpcClient.rpc('create_venta_payment', {
    p_venta_id: ventaId,
    p_fecha_inicio: toDateOnly(payload.fechaInicio ?? new Date()),
    p_fecha_fin: toDateOnly(payload.fechaVencimiento ?? new Date()),
    p_ciclo_pago: payload.cicloPago ?? 'mensual',
    p_precio_original: precio,
    p_descuento: descuento,
    p_total_original: monto,
    p_moneda_original: moneda,
    p_total_usd: usd,
    p_exchange_rate: rate,
    p_metodo_pago_id: payload.metodoPagoId || null,
    p_metodo_pago_nombre_snapshot: payload.metodoPago || null,
    p_fecha_pago: toIso(payload.fecha ?? new Date()),
    p_pago_notas: payload.notas ?? null,
  });

  if (error) throw new Error(error.message);
  return assertRpcStringId(data, 'create_venta_payment');
}

async function convertAmountToUSD(amount: number, moneda: string) {
  const { currencyService } = await import('@/lib/services/currencyService');
  const usd = await currencyService.convertToUSD(amount, moneda);
  return {
    usd,
    rate: moneda === 'USD' || amount === 0 || usd === 0 ? 1 : amount / usd,
  };
}
