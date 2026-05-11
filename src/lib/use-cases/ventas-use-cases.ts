import { format } from 'date-fns';

import { getMetodoPagoById } from '@/lib/supabase/catalogos-repository';
import { timestampToDate, toDateOnly, toIso } from '@/lib/supabase/dates';
import { ENTITIES, type QueryFilter } from '@/lib/supabase/entities';
import {
  adjustCategoriaSuscripciones,
  adjustServiciosActivos,
  createVenta,
  createVentaWithInitialPayment,
  getPagoVentaById,
  getVentaById,
  countVentas,
  queryPagosVenta,
  queryVentas,
  removePagoVenta,
  removeVenta,
  removeVentaWithPayments,
  updateLatestVentaPeriodo,
  updateVenta,
  updateVentaPaymentAndPeriod,
} from '@/lib/supabase/ventas-repository';
import {
  adjustIngresosStats,
  getDiaKeyFromDate,
  getMesKeyFromDate,
  upsertVentaPronostico,
} from '@/lib/services/dashboardStatsService';
import { sincronizarUnaVenta } from '@/lib/services/notificationSyncService';
import { currencyService } from '@/lib/services/currencyService';
import { crearPagoRenovacion } from '@/lib/services/pagosVentaService';
import { getVentaConUltimoPago } from '@/lib/services/ventaSyncService';
import { syncUsuarioMetodoPago } from '@/lib/services/usuarioMetodoPagoSyncService';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import { calculateDiscountedAmount, roundToDecimals } from '@/lib/utils/calculations';
import { safeAsyncSideEffect, toMoneyNumber } from '@/lib/utils/safety';
import { isPendingUserPaymentMethodId } from '@/lib/utils/usuarioMetodoPago';
import type { ActivityLog, MetodoPago, PagoVenta, VentaDoc } from '@/types';
import type { VentaPronostico } from '@/types/dashboard';

export const VENTAS_COLLECTION = ENTITIES.VENTAS;
export { timestampToDate };

type RecordActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
type LogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;

type VentaInput = Omit<VentaDoc, 'id' | 'createdAt' | 'updatedAt'> & {
  pagos?: Array<{
    fecha?: Date | null;
    total?: number;
    notas?: string;
  }>;
};

type VentaPagoInput = {
  periodoRenovacion: string;
  metodoPagoId: string;
  metodoPagoNombre?: string;
  moneda?: string;
  costo: number;
  descuento?: number;
  fechaInicio: Date;
  fechaVencimiento: Date;
  notas?: string;
  planId?: string;
  planNombre?: string;
  planTipoNombre?: string;
};

type VentaPagoResult = {
  costo: number;
  descuentoNumero: number;
  monto: number;
  notaPrincipal: string;
  metodoPagoNombre: string;
  moneda: string;
  pronostico: VentaPronostico;
  syncPaymentMethodFailed: boolean;
};

const VENTA_TABLE_UPDATE_KEYS = new Set([
  'clienteId',
  'servicioId',
  'categoriaId',
  'estado',
  'perfilNumero',
  'perfilNombre',
  'codigo',
  'cortadaAt',
  'cortadaBy',
  'motivoCorte',
  'archivadoAt',
  'archivadoBy',
  'motivoArchivado',
  'notas',
]);

function getVentaTableUpdates(updates: Partial<VentaDoc>): Partial<VentaDoc> {
  const result: Partial<VentaDoc> = {};
  const source = updates as Record<string, unknown>;
  const target = result as Record<string, unknown>;
  for (const key of VENTA_TABLE_UPDATE_KEYS) {
    if (source[key] !== undefined) target[key] = source[key];
  }
  return result;
}

async function getUsdValues(amount: number, moneda: string) {
  const normalizedAmount = toMoneyNumber(amount);
  const usd = await currencyService.convertToUSD(normalizedAmount, moneda);
  return {
    usd,
    rate: moneda === 'USD' || normalizedAmount === 0 || usd === 0 ? 1 : normalizedAmount / usd,
  };
}

function nullableMetodoPagoId(id?: string | null) {
  return isPendingUserPaymentMethodId(id) ? null : id;
}

function ventaBaseFromRecord(doc: Record<string, unknown>): VentaDoc {
  return {
    id: doc.id as string,
    clienteId: (doc.clienteId as string) || '',
    clienteNombre: (doc.clienteNombre as string) || 'Sin cliente',
    categoriaId: (doc.categoriaId as string) || '',
    categoriaNombre: (doc.categoriaNombre as string) || undefined,
    servicioId: (doc.servicioId as string) || '',
    servicioNombre: (doc.servicioNombre as string) || 'Servicio',
    servicioCorreo: (doc.servicioCorreo as string) || undefined,
    servicioContrasena: (doc.servicioContrasena as string) || undefined,
    clienteTelefono: (doc.clienteTelefono as string) || undefined,
    estado: (doc.estado as VentaDoc['estado']) ?? 'activo',
    cortadaAt: doc.cortadaAt ? new Date(doc.cortadaAt as string) : null,
    perfilNumero: (doc.perfilNumero as number) ?? null,
    perfilNombre: (doc.perfilNombre as string) || undefined,
    codigo: (doc.codigo as string) || undefined,
    notas: (doc.notas as string) || undefined,
    createdAt: (doc.createdAt as Date) || undefined,
    updatedAt: (doc.updatedAt as Date) || undefined,
    fechaInicio: (doc.fechaInicio as Date) || new Date(),
    fechaFin: (doc.fechaFin as Date) || new Date(),
    cicloPago: (doc.cicloPago as VentaDoc['cicloPago']) || 'mensual',
  };
}

function getPagoValues(venta: VentaDoc, input: VentaPagoInput) {
  const costo = roundToDecimals(input.costo);
  const descuentoNumero = roundToDecimals(Number(input.descuento) || 0);
  const monto = calculateDiscountedAmount(costo, descuentoNumero);
  const notaPrincipal = input.notas?.trim() ?? '';
  const metodoPagoNombre = input.metodoPagoNombre || venta.metodoPagoNombre || '';
  const moneda = input.moneda || venta.moneda || 'USD';

  return { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda };
}

export function toVentaPronostico(v: VentaDoc): VentaPronostico | null {
  const precioFinal = v.precioFinal ?? v.precio ?? 0;
  if (v.estado === 'inactivo' || !v.fechaFin || !v.cicloPago || precioFinal <= 0) return null;
  return {
    id: v.id,
    categoriaId: v.categoriaId ?? '',
    fechaInicio: v.fechaInicio instanceof Date ? format(v.fechaInicio, "yyyy-MM-dd'T'HH:mm:ss") : String(v.fechaInicio ?? new Date()),
    fechaFin: v.fechaFin instanceof Date ? format(v.fechaFin, "yyyy-MM-dd'T'HH:mm:ss") : String(v.fechaFin),
    cicloPago: v.cicloPago,
    precioFinal,
    moneda: v.moneda || 'USD',
  };
}

export function getVentaUseCase<T = VentaDoc>(id: string) {
  return getVentaById<T>(id);
}

export function fetchVentasByFiltersUseCase<T = VentaDoc>(filters: QueryFilter[] = []) {
  return queryVentas<T>(filters);
}

export function fetchVentasByClienteUseCase<T = VentaDoc>(clienteId: string) {
  return queryVentas<T>([{ field: 'clienteId', operator: '==', value: clienteId }]);
}

export async function fetchVentasByClienteIdsUseCase<T = VentaDoc>(clienteIds: string[], chunkSize = 30): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < clienteIds.length; i += chunkSize) {
    chunks.push(clienteIds.slice(i, i + chunkSize));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      queryVentas<T>([{ field: 'clienteId', operator: 'in', value: chunk }])
    )
  );
  return results.flat();
}

export function fetchVentasByServicioUseCase<T = VentaDoc>(servicioId: string) {
  return queryVentas<T>([{ field: 'servicioId', operator: '==', value: servicioId }]);
}

export function countVentasActivasByServicioUseCase(servicioId: string) {
  return countVentas([
    { field: 'servicioId', operator: '==', value: servicioId },
    { field: 'estado', operator: '!=', value: 'inactivo' },
  ]);
}

export function fetchPagosVentaByVentaUseCase<T = PagoVenta>(ventaId: string) {
  return queryPagosVenta<T>([{ field: 'ventaId', operator: '==', value: ventaId }]);
}

export async function fetchPagosVentaByVentaIdsUseCase<T = PagoVenta>(ventaIds: string[], chunkSize = 10): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ventaIds.length; i += chunkSize) {
    chunks.push(ventaIds.slice(i, i + chunkSize));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      queryPagosVenta<T>([{ field: 'ventaId', operator: 'in', value: chunk }])
    )
  );
  return results.flat();
}

export async function createVentaUseCase(
  ventaData: VentaInput,
  options: { logContext: LogContext; recordActivityLog?: RecordActivityLog }
) {
  if (!ventaData.planId || !ventaData.planNombre) {
    throw new Error('Una venta debe tener un plan seleccionado.');
  }
  const { pagos, ...ventaDataLimpia } = ventaData;
  const pagoInicial = pagos?.[0];
  const ventaId = pagoInicial
    ? await (async () => {
        const monto = Number(pagoInicial.total ?? ventaData.precioFinal ?? 0);
        const precio = Number(ventaData.precio ?? monto);
        const descuento = Number(ventaData.descuento ?? 0);
        const moneda = ventaData.moneda ?? 'USD';
        const { usd, rate } = await getUsdValues(monto, moneda);

        return createVentaWithInitialPayment({
          p_cliente_id: ventaData.clienteId || null,
          p_servicio_id: ventaData.servicioId,
          p_categoria_id: ventaData.categoriaId,
          p_estado: ventaData.estado ?? 'activo',
          p_perfil_numero: ventaData.perfilNumero ?? null,
          p_perfil_nombre: ventaData.perfilNombre ?? null,
          p_codigo: ventaData.codigo ?? null,
          p_notas: ventaData.notas ?? null,
          p_fecha_inicio: toDateOnly(ventaData.fechaInicio ?? new Date()),
          p_fecha_fin: toDateOnly(ventaData.fechaFin ?? new Date()),
          p_ciclo_pago: ventaData.cicloPago ?? 'mensual',
          p_precio_original: precio,
          p_descuento: descuento,
          p_total_original: monto,
          p_moneda_original: moneda,
          p_total_usd: usd,
          p_exchange_rate: rate,
          p_metodo_pago_id: nullableMetodoPagoId(ventaData.metodoPagoId),
          p_metodo_pago_nombre_snapshot: ventaData.metodoPagoNombre ?? null,
          p_fecha_pago: toIso(pagoInicial.fecha ?? new Date()),
          p_pago_notas: pagoInicial.notas ?? '',
          p_plan_id: ventaData.planId,
          p_plan_nombre_snapshot: ventaData.planNombre,
          p_plan_tipo_nombre_snapshot: ventaData.planTipoNombre ?? null,
        });
      })()
    : await createVenta(getVentaTableUpdates(ventaDataLimpia) as Omit<VentaDoc, 'id'>);

  const venta: VentaDoc = {
    ...ventaDataLimpia,
    id: ventaId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (ventaData.clienteId && (ventaData.estado ?? 'activo') !== 'inactivo') {
    await adjustServiciosActivos(ventaData.clienteId, 1);
  }

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'creacion',
    entidad: 'venta',
    entidadId: ventaId,
    entidadNombre: `${ventaData.clienteNombre} - ${ventaData.servicioNombre}`,
    detalles: `Venta creada: ${ventaData.clienteNombre} / ${ventaData.servicioNombre} - $${ventaData.precioFinal ?? 0} ${ventaData.moneda ?? 'USD'} - ${format(ventaData.fechaInicio ?? new Date(), 'dd/MM/yyyy')} al ${format(ventaData.fechaFin ?? new Date(), 'dd/MM/yyyy')} (${ventaData.cicloPago})`,
    metadata: {
      precioFinal: ventaData.precioFinal ?? 0,
      moneda: ventaData.moneda ?? 'USD',
      cicloPago: ventaData.cicloPago,
      fechaInicio: toDateOnly(ventaData.fechaInicio ?? new Date()),
      fechaFin: toDateOnly(ventaData.fechaFin ?? new Date()),
      clienteId: ventaData.clienteId,
      servicioId: ventaData.servicioId,
      origen: 'createVentaUseCase',
    },
  });

  if (ventaDataLimpia.categoriaId && ventaData.precioFinal) {
    const precioFinalUSD = await currencyService.convertToUSD(ventaData.precioFinal, ventaData.moneda ?? 'USD');
    await adjustCategoriaSuscripciones(ventaDataLimpia.categoriaId, 1, precioFinalUSD);
  }

  adjustIngresosStats({
    delta: ventaData.precioFinal ?? 0,
    moneda: ventaData.moneda ?? 'USD',
    mes: getMesKeyFromDate(ventaData.fechaInicio ?? new Date()),
    dia: getDiaKeyFromDate(ventaData.fechaInicio ?? new Date()),
    categoriaId: ventaData.categoriaId ?? '',
    categoriaNombre: ventaData.categoriaNombre ?? '',
  }).catch((err) => console.error('[VentasUseCases] Error updating dashboard ingresos:', err));

  const pronostico = toVentaPronostico(venta);
  upsertVentaPronostico(pronostico, venta.id).catch((err) => {
    console.error('[VentasUseCases] Error upserting pronostico:', err);
  });

  safeAsyncSideEffect(sincronizarUnaVenta(ventaId), {
    operation: 'sincronizarUnaVenta',
    entity: 'venta',
    entityId: ventaId,
  });

  return { venta, pronostico };
}

export async function getVentaConPagoActualUseCase(id: string): Promise<VentaDoc | null> {
  const doc = await getVentaById<Record<string, unknown>>(id);
  if (!doc) return null;
  return getVentaConUltimoPago(ventaBaseFromRecord(doc));
}

export async function renewVentaUseCase(
  venta: VentaDoc,
  input: VentaPagoInput,
  options: {
    logContext?: LogContext;
    recordActivityLog?: RecordActivityLog;
    logPrefix?: string;
  } = {}
): Promise<VentaPagoResult> {
  if (!venta.id) throw new Error('Venta sin id');
  const { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda } = getPagoValues(venta, input);
  const planId = input.planId ?? venta.planId;
  const planNombre = input.planNombre ?? venta.planNombre;
  const planTipoNombre = input.planTipoNombre ?? venta.planTipoNombre;
  if (!planId || !planNombre) {
    throw new Error('Una renovación debe tener un plan seleccionado.');
  }

  await crearPagoRenovacion(
    venta.id,
    venta.clienteId || '',
    venta.clienteNombre,
    venta.categoriaId || '',
    monto,
    metodoPagoNombre,
    input.metodoPagoId,
    moneda,
    input.periodoRenovacion as VentaDoc['cicloPago'],
    notaPrincipal,
    input.fechaInicio,
    input.fechaVencimiento,
    costo,
    descuentoNumero,
    planId,
    planNombre,
    planTipoNombre
  );

  await updateVenta(venta.id, getVentaTableUpdates({ notas: notaPrincipal }));

  let syncPaymentMethodFailed = false;
  try {
    await syncUsuarioMetodoPago({
      usuarioId: venta.clienteId,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre,
      moneda,
    });
  } catch (error) {
    syncPaymentMethodFailed = true;
    console.error('[VentasUseCases] Error syncing user payment method:', error);
  }

  const pronostico = {
    id: venta.id,
    categoriaId: venta.categoriaId ?? '',
    fechaInicio: input.fechaInicio.toISOString(),
    fechaFin: input.fechaVencimiento.toISOString(),
    cicloPago: input.periodoRenovacion,
    precioFinal: monto,
    moneda,
  };

  safeAsyncSideEffect(upsertVentaPronostico(pronostico, venta.id), {
    operation: 'upsertVentaPronostico',
    entity: 'venta',
    entityId: venta.id,
  });
  safeAsyncSideEffect(adjustIngresosStats({
    delta: monto,
    moneda,
    mes: getMesKeyFromDate(input.fechaInicio),
    dia: getDiaKeyFromDate(input.fechaInicio),
    categoriaId: venta.categoriaId ?? '',
    categoriaNombre: venta.categoriaNombre ?? '',
  }), {
    operation: 'adjustIngresosStats',
    entity: 'venta',
    entityId: venta.id,
  });

  await options.recordActivityLog?.({
    ...(options.logContext ?? { usuarioId: 'sistema', usuarioEmail: 'sistema' }),
    accion: 'renovacion',
    entidad: 'venta',
    entidadId: venta.id,
    entidadNombre: `${venta.clienteNombre} - ${venta.servicioNombre}`,
    detalles: `${options.logPrefix ?? 'Venta renovada'}: ${venta.clienteNombre} / ${venta.servicioNombre} - ${moneda} ${monto.toFixed(2)} - hasta ${format(input.fechaVencimiento, 'dd/MM/yyyy')} (${input.periodoRenovacion})`,
    metadata: {
      monto,
      moneda,
      cicloPago: input.periodoRenovacion,
      fechaInicio: toDateOnly(input.fechaInicio),
      fechaFin: toDateOnly(input.fechaVencimiento),
      descuento: descuentoNumero,
      origen: 'renewVentaUseCase',
    },
  });

  return { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda, pronostico, syncPaymentMethodFailed };
}

export async function updateVentaPagoUseCase(
  venta: VentaDoc,
  pagoId: string,
  input: VentaPagoInput
) {
  const { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda } = getPagoValues(venta, input);
  const { usd, rate } = await getUsdValues(monto, moneda);
  const pago = await getPagoVentaById<PagoVenta & { ventaPeriodoId?: string }>(pagoId);

  if (pago?.ventaPeriodoId) {
    await updateVentaPaymentAndPeriod(pagoId, {
      precio: costo,
      descuento: descuentoNumero,
      monto,
      moneda,
      montoUsd: usd,
      exchangeRate: rate,
      cicloPago: (input.periodoRenovacion || 'mensual') as NonNullable<VentaDoc['cicloPago']>,
      fechaInicio: input.fechaInicio,
      fechaVencimiento: input.fechaVencimiento,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre,
      notas: notaPrincipal,
    });
  }

  let syncPaymentMethodFailed = false;
  try {
    await syncUsuarioMetodoPago({
      usuarioId: venta.clienteId,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre,
      moneda,
    });
  } catch (error) {
    syncPaymentMethodFailed = true;
    console.error('[VentasUseCases] Error syncing user payment method:', error);
  }

  const ventaActualizada = await getVentaConPagoActualUseCase(venta.id);
  const pronostico = ventaActualizada ? toVentaPronostico(ventaActualizada) : null;
  safeAsyncSideEffect(upsertVentaPronostico(pronostico, venta.id), {
    operation: 'upsertVentaPronostico',
    entity: 'venta',
    entityId: venta.id,
  });

  return { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda, syncPaymentMethodFailed, pronostico };
}

export async function deleteVentaPagoUseCase(ventaId: string, pagoId: string) {
  await removePagoVenta(pagoId);
  const ventaActualizada = await getVentaConPagoActualUseCase(ventaId);
  const pronostico = ventaActualizada ? toVentaPronostico(ventaActualizada) : null;
  safeAsyncSideEffect(upsertVentaPronostico(pronostico, ventaId), {
    operation: 'upsertVentaPronostico',
    entity: 'venta',
    entityId: ventaId,
  });

  return { ventaActualizada, pronostico };
}

export async function updateVentaWithLatestPagoUseCase(
  id: string,
  updates: Partial<VentaDoc>,
  pagoUpdates: {
    precio: number;
    descuento: number;
    monto: number;
    metodoPagoId: string;
    metodoPago: string;
    moneda: string;
    cicloPago?: VentaDoc['cicloPago'];
    fechaInicio: Date;
    fechaVencimiento: Date;
    planId?: string | null;
    planNombre?: string | null;
    planTipoNombre?: string | null;
  },
  options: {
    currentVenta?: VentaDoc;
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
) {
  const result = await updateVentaUseCase(id, updates, options);
  const { usd, rate } = await getUsdValues(pagoUpdates.monto, pagoUpdates.moneda);
  const cicloPago = (pagoUpdates.cicloPago || 'mensual') as NonNullable<VentaDoc['cicloPago']>;

  const pagos = await queryPagosVenta<PagoVenta>([{ field: 'ventaId', operator: '==', value: id }]);

  if (pagos.length > 0) {
    const pagoMasReciente = [...pagos].sort((a, b) => {
      const dateA = a.fecha instanceof Date ? a.fecha : new Date(a.fecha);
      const dateB = b.fecha instanceof Date ? b.fecha : new Date(b.fecha);
      return dateB.getTime() - dateA.getTime();
    })[0];

    await updateVentaPaymentAndPeriod(pagoMasReciente.id, {
      precio: pagoUpdates.precio,
      descuento: pagoUpdates.descuento,
      monto: pagoUpdates.monto,
      moneda: pagoUpdates.moneda,
      montoUsd: usd,
      exchangeRate: rate,
      cicloPago,
      fechaInicio: pagoUpdates.fechaInicio,
      fechaVencimiento: pagoUpdates.fechaVencimiento,
      metodoPagoId: pagoUpdates.metodoPagoId,
      metodoPagoNombre: pagoUpdates.metodoPago,
      planId: pagoUpdates.planId,
      planNombre: pagoUpdates.planNombre,
      planTipoNombre: pagoUpdates.planTipoNombre,
    });
  } else {
    await updateLatestVentaPeriodo(id, {
      precio: pagoUpdates.precio,
      descuento: pagoUpdates.descuento,
      monto: pagoUpdates.monto,
      moneda: pagoUpdates.moneda,
      montoUsd: usd,
      exchangeRate: rate,
      cicloPago,
      fechaInicio: pagoUpdates.fechaInicio,
      fechaVencimiento: pagoUpdates.fechaVencimiento,
      planId: pagoUpdates.planId,
      planNombre: pagoUpdates.planNombre,
      planTipoNombre: pagoUpdates.planTipoNombre,
    });
  }

  if (updates.clienteId && updates.metodoPagoId) {
    try {
      await syncUsuarioMetodoPago({
        usuarioId: updates.clienteId,
        metodoPagoId: updates.metodoPagoId,
        metodoPagoNombre: updates.metodoPagoNombre,
        moneda: updates.moneda,
      });
    } catch (error) {
      console.error('[VentasUseCases] Error syncing user payment method:', error);
      return { ...result, syncPaymentMethodFailed: true };
    }
  }

  return { ...result, syncPaymentMethodFailed: false };
}

export async function updateVentaUseCase(
  id: string,
  updates: Partial<VentaDoc>,
  options: {
    currentVenta?: VentaDoc;
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
) {
  const ventaAnterior = options.currentVenta ?? await getVentaById<VentaDoc>(id);
  if (!ventaAnterior) throw new Error('Venta no encontrada');

  let finalUpdates = { ...updates };
  if (updates.metodoPagoId !== undefined) {
    const metodoPago = updates.metodoPagoId
      ? await getMetodoPagoById<MetodoPago>(updates.metodoPagoId)
      : null;

    finalUpdates = {
      ...finalUpdates,
      metodoPagoNombre: metodoPago?.nombre,
      moneda: metodoPago?.moneda,
    };
  }

  await updateVenta(id, getVentaTableUpdates(finalUpdates));

  const precioAnterior = ventaAnterior.precioFinal || 0;
  const precioNuevo = updates.precioFinal !== undefined ? updates.precioFinal : precioAnterior;
  const categoriaAnterior = ventaAnterior.categoriaId;
  const categoriaNueva = updates.categoriaId || categoriaAnterior;
  const estadoAnterior = ventaAnterior.estado || 'activo';
  const estadoNuevo = updates.estado || estadoAnterior;
  const esCorteVenta = estadoAnterior !== estadoNuevo && estadoNuevo === 'inactivo';

  let serviceProfileDelta: { servicioId: string; shouldIncrement: boolean } | null = null;

  if (updates.estado !== undefined && estadoAnterior !== estadoNuevo) {
    const clienteId = ventaAnterior.clienteId;
    if (clienteId) {
      if (estadoNuevo === 'inactivo') {
        await adjustServiciosActivos(clienteId, -1);
      } else if (estadoAnterior === 'inactivo') {
        await adjustServiciosActivos(clienteId, 1);
      }
    }

    if (ventaAnterior.servicioId) {
      serviceProfileDelta = {
        servicioId: ventaAnterior.servicioId,
        shouldIncrement: estadoAnterior === 'inactivo',
      };
    }
  }

  if (updates.categoriaId && categoriaAnterior !== categoriaNueva) {
    if (categoriaAnterior) {
      const precioUSD = await currencyService.convertToUSD(precioAnterior, ventaAnterior.moneda ?? 'USD');
      await adjustCategoriaSuscripciones(categoriaAnterior, -1, -precioUSD);
    }
    if (categoriaNueva) {
      const precioUSD = await currencyService.convertToUSD(precioNuevo, updates.moneda ?? ventaAnterior.moneda ?? 'USD');
      await adjustCategoriaSuscripciones(categoriaNueva, 1, precioUSD);
    }
  } else if (estadoAnterior !== estadoNuevo) {
    if (categoriaAnterior) {
      const precioUSD = await currencyService.convertToUSD(precioNuevo, updates.moneda ?? ventaAnterior.moneda ?? 'USD');
      const delta = estadoNuevo === 'inactivo' ? -1 : 1;
      await adjustCategoriaSuscripciones(categoriaAnterior, delta, delta * precioUSD);
    }
  } else if (updates.precioFinal !== undefined && precioAnterior !== precioNuevo) {
    const diffOriginal = precioNuevo - precioAnterior;
    const diffUSD = await currencyService.convertToUSD(diffOriginal, updates.moneda ?? ventaAnterior.moneda ?? 'USD');
    if (categoriaAnterior && diffUSD !== 0) {
      await adjustCategoriaSuscripciones(categoriaAnterior, 0, diffUSD);
    }
  }

  const ventaActualizada = {
    ...ventaAnterior,
    ...finalUpdates,
    updatedAt: new Date(),
  } as VentaDoc;
  const cambios = detectarCambios(
    'venta',
    ventaAnterior as unknown as Record<string, unknown>,
    ventaActualizada as unknown as Record<string, unknown>
  );

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: esCorteVenta ? 'corte' : 'actualizacion',
    entidad: 'venta',
    entidadId: id,
    entidadNombre: (ventaAnterior.clienteNombre && ventaAnterior.servicioNombre)
      ? `${ventaAnterior.clienteNombre} - ${ventaAnterior.servicioNombre}`
      : '',
    detalles: esCorteVenta
      ? `Venta cortada: ${ventaAnterior.clienteNombre ?? '-'} / ${ventaAnterior.servicioNombre ?? '-'} - estado cambiado a inactivo, perfil liberado`
      : `Venta actualizada: ${ventaAnterior.clienteNombre ?? '-'} / ${ventaAnterior.servicioNombre ?? '-'}`,
    cambios: cambios.length > 0 ? cambios : undefined,
    metadata: {
      cambiosCount: cambios.length,
      origen: 'updateVentaUseCase',
    },
  });

  const pronostico = toVentaPronostico(ventaActualizada);
  upsertVentaPronostico(pronostico, id).catch((err) => {
    console.error('[VentasUseCases] Error upserting pronostico:', err);
  });

  return { ventaAnterior, ventaActualizada, finalUpdates, pronostico, serviceProfileDelta };
}

export async function deleteVentaUseCase(
  id: string,
  options: {
    venta?: VentaDoc;
    servicioId?: string;
    perfilNumero?: number | null;
    deletePagos?: boolean;
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
) {
  const ventaEliminada = options.venta ?? await getVentaById<VentaDoc>(id);

  if (options.deletePagos) {
    await removeVentaWithPayments(id, true);
  } else {
    await removeVenta(id);
  }

  const serviceProfileDelta = options.servicioId && options.perfilNumero
    ? { servicioId: options.servicioId, shouldIncrement: false }
    : null;

  if (ventaEliminada?.clienteId && (ventaEliminada.estado ?? 'activo') !== 'inactivo') {
    await adjustServiciosActivos(ventaEliminada.clienteId, -1);
  }

  if (ventaEliminada?.categoriaId && ventaEliminada?.precioFinal) {
    const precioFinalUSD = await currencyService.convertToUSD(ventaEliminada.precioFinal, ventaEliminada.moneda ?? 'USD');
    await adjustCategoriaSuscripciones(ventaEliminada.categoriaId, -1, -precioFinalUSD);
  }

  if (ventaEliminada?.precioFinal) {
    adjustIngresosStats({
      delta: -ventaEliminada.precioFinal,
      moneda: ventaEliminada.moneda ?? 'USD',
      mes: getMesKeyFromDate(ventaEliminada.fechaInicio ?? new Date()),
      dia: getDiaKeyFromDate(ventaEliminada.fechaInicio ?? new Date()),
      categoriaId: ventaEliminada.categoriaId ?? '',
      categoriaNombre: ventaEliminada.categoriaNombre ?? '',
    }).catch((err) => console.error('[VentasUseCases] Error reverting dashboard ingresos:', err));
  }

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'eliminacion',
    entidad: 'venta',
    entidadId: id,
    entidadNombre: `${ventaEliminada?.clienteNombre ?? ''} - ${ventaEliminada?.servicioNombre ?? ''}`,
    detalles: `Venta eliminada: ${ventaEliminada?.clienteNombre} / ${ventaEliminada?.servicioNombre}`,
    metadata: {
      precioFinal: ventaEliminada?.precioFinal ?? null,
      moneda: ventaEliminada?.moneda ?? null,
      categoriaId: ventaEliminada?.categoriaId ?? null,
      deletePagos: options.deletePagos ?? false,
      origen: 'deleteVentaUseCase',
    },
  });

  upsertVentaPronostico(null, id).catch((err) => {
    console.error('[VentasUseCases] Error removing pronostico:', err);
  });

  return { ventaEliminada, serviceProfileDelta };
}
