import { supabase } from './client';
import { ENTITIES, writeTable } from './entities';
import { insertRawRow } from './write-utils';
import { toDateOnly, toIso } from './dates';

export async function createPagoServicio(payload: Record<string, unknown>): Promise<string> {
  const servicioId = String(payload.servicioId ?? '');
  if (!servicioId) throw new Error('servicioId es requerido para pagos_servicio');

  const monto = Number(payload.monto ?? 0);
  const moneda = String(payload.moneda ?? 'USD');
  const { usd, rate } = await convertAmountToUSD(monto, moneda);
  const periodoId = await ensureServicioPeriodo(servicioId, payload, monto, moneda, usd, rate);

  return insertRawRow(writeTable(ENTITIES.PAGOS_SERVICIO), {
    servicio_periodo_id: periodoId,
    servicio_id: servicioId,
    fecha_pago: toIso(payload.fecha ?? new Date()),
    estado: 'registrado',
    monto_original: monto,
    moneda_original: moneda,
    monto_usd: usd,
    exchange_rate: rate,
    categoria_id_snapshot: payload.categoriaId || null,
    metodo_pago_id: payload.metodoPagoId || null,
    metodo_pago_nombre_snapshot: payload.metodoPagoNombre || null,
    notas: payload.notas ?? null,
  });
}

export async function createPagoVenta(payload: Record<string, unknown>): Promise<string> {
  const ventaId = String(payload.ventaId ?? '');
  if (!ventaId) throw new Error('ventaId es requerido para pagos_venta');

  const monto = Number(payload.monto ?? 0);
  const precio = Number(payload.precio ?? monto);
  const descuento = Number(payload.descuento ?? 0);
  const moneda = String(payload.moneda ?? 'USD');
  const { usd, rate } = await convertAmountToUSD(monto, moneda);
  const periodoId = await ensureVentaPeriodo(ventaId, payload, precio, descuento, monto, moneda, usd, rate);

  return insertRawRow(writeTable(ENTITIES.PAGOS_VENTA), {
    venta_periodo_id: periodoId,
    venta_id: ventaId,
    fecha_pago: toIso(payload.fecha ?? new Date()),
    estado: 'registrado',
    monto_original: monto,
    moneda_original: moneda,
    monto_usd: usd,
    exchange_rate: rate,
    metodo_pago_id: payload.metodoPagoId || null,
    metodo_pago_nombre_snapshot: payload.metodoPago || null,
    notas: payload.notas ?? null,
  });
}

async function ensureServicioPeriodo(
  servicioId: string,
  payload: Record<string, unknown>,
  monto: number,
  moneda: string,
  usd: number,
  rate: number
): Promise<string> {
  const numeroPeriodo = await nextPeriodNumber('servicio_periodos', 'servicio_id', servicioId);
  const { data, error } = await supabase
    .from('servicio_periodos')
    .insert({
      servicio_id: servicioId,
      numero_periodo: numeroPeriodo,
      tipo: numeroPeriodo === 1 ? 'inicial' : 'renovacion',
      fecha_inicio: toDateOnly(payload.fechaInicio ?? new Date()),
      fecha_vencimiento: toDateOnly(payload.fechaVencimiento ?? new Date()),
      ciclo_pago: payload.cicloPago ?? 'mensual',
      costo_original: monto,
      moneda_original: moneda,
      costo_usd: usd,
      exchange_rate: rate,
      renovacion_automatica: Boolean(payload.renovacionAutomatica ?? false),
    } as never)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

async function ensureVentaPeriodo(
  ventaId: string,
  payload: Record<string, unknown>,
  precio: number,
  descuento: number,
  total: number,
  moneda: string,
  usd: number,
  rate: number
): Promise<string> {
  const numeroPeriodo = await nextPeriodNumber('venta_periodos', 'venta_id', ventaId);
  const { data, error } = await supabase
    .from('venta_periodos')
    .insert({
      venta_id: ventaId,
      numero_periodo: numeroPeriodo,
      tipo: numeroPeriodo === 1 ? 'inicial' : 'renovacion',
      fecha_inicio: toDateOnly(payload.fechaInicio ?? new Date()),
      fecha_fin: toDateOnly(payload.fechaVencimiento ?? new Date()),
      ciclo_pago: payload.cicloPago ?? 'mensual',
      precio_original: precio,
      descuento,
      total_original: total,
      moneda_original: moneda,
      total_usd: usd,
      exchange_rate: rate,
    } as never)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

async function nextPeriodNumber(table: 'servicio_periodos' | 'venta_periodos', field: string, id: string) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(field, id);
  if (error) throw new Error(error.message);
  return (count ?? 0) + 1;
}

async function convertAmountToUSD(amount: number, moneda: string) {
  const { currencyService } = await import('@/lib/services/currencyService');
  const usd = await currencyService.convertToUSD(amount, moneda);
  return {
    usd,
    rate: moneda === 'USD' || amount === 0 ? 1 : amount / usd,
  };
}
