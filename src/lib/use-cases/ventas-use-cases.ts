import { format } from 'date-fns';

import { getMetodoPagoById } from '@/lib/supabase/catalogos-repository';
import {
  adjustCategoriaSuscripciones,
  adjustServiciosActivos,
  createPagoVenta,
  createVenta,
  getVentaById,
  queryPagosVenta,
  removePagoVenta,
  removeVenta,
  updatePagoVenta,
  updateVenta,
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
import type { ActivityLog, MetodoPago, PagoVenta, VentaDoc } from '@/types';
import type { VentaPronostico } from '@/types/dashboard';

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
  if (v.estado === 'inactivo' || !v.fechaFin || !v.cicloPago) return null;
  return {
    id: v.id,
    categoriaId: v.categoriaId ?? '',
    fechaInicio: v.fechaInicio instanceof Date ? format(v.fechaInicio, "yyyy-MM-dd'T'HH:mm:ss") : String(v.fechaInicio ?? new Date()),
    fechaFin: v.fechaFin instanceof Date ? format(v.fechaFin, "yyyy-MM-dd'T'HH:mm:ss") : String(v.fechaFin),
    cicloPago: v.cicloPago,
    precioFinal: v.precio || v.precioFinal || 0,
    moneda: v.moneda || 'USD',
  };
}

export async function createVentaUseCase(
  ventaData: VentaInput,
  options: { logContext: LogContext; recordActivityLog?: RecordActivityLog }
) {
  const { pagos, ...ventaDataLimpia } = ventaData;
  const ventaId = await createVenta(ventaDataLimpia);

  if (pagos && pagos.length > 0) {
    const pagoInicial = pagos[0];
    await createPagoVenta({
      ventaId,
      clienteId: ventaData.clienteId || '',
      clienteNombre: ventaData.clienteNombre,
      categoriaId: ventaData.categoriaId,
      fecha: pagoInicial.fecha || new Date(),
      monto: pagoInicial.total || ventaData.precioFinal,
      precio: ventaData.precio,
      descuento: ventaData.descuento,
      metodoPagoId: ventaData.metodoPagoId,
      metodoPago: ventaData.metodoPagoNombre,
      moneda: ventaData.moneda,
      notas: pagoInicial.notas ?? '',
      isPagoInicial: true,
      cicloPago: ventaData.cicloPago,
      fechaInicio: ventaData.fechaInicio,
      fechaVencimiento: ventaData.fechaFin,
    });
  }

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

  sincronizarUnaVenta(ventaId).catch(() => {});

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
    descuentoNumero
  );

  await updateVenta(venta.id, {
    fechaFin: input.fechaVencimiento,
    fechaInicio: input.fechaInicio,
    cicloPago: input.periodoRenovacion,
    notas: notaPrincipal,
  });

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

  upsertVentaPronostico(pronostico, venta.id).catch(() => {});
  adjustIngresosStats({
    delta: monto,
    moneda,
    mes: getMesKeyFromDate(input.fechaInicio),
    dia: getDiaKeyFromDate(input.fechaInicio),
    categoriaId: venta.categoriaId ?? '',
    categoriaNombre: venta.categoriaNombre ?? '',
  }).catch(() => {});

  await options.recordActivityLog?.({
    ...(options.logContext ?? { usuarioId: 'sistema', usuarioEmail: 'sistema' }),
    accion: 'renovacion',
    entidad: 'venta',
    entidadId: venta.id,
    entidadNombre: `${venta.clienteNombre} - ${venta.servicioNombre}`,
    detalles: `${options.logPrefix ?? 'Venta renovada'}: ${venta.clienteNombre} / ${venta.servicioNombre} - ${moneda} ${monto.toFixed(2)} - hasta ${format(input.fechaVencimiento, 'dd/MM/yyyy')} (${input.periodoRenovacion})`,
  });

  return { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda, pronostico, syncPaymentMethodFailed };
}

export async function updateVentaPagoUseCase(
  venta: VentaDoc,
  pagoId: string,
  input: VentaPagoInput
) {
  const { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda } = getPagoValues(venta, input);

  await updatePagoVenta(pagoId, {
    precio: costo,
    descuento: descuentoNumero,
    monto,
    metodoPagoId: input.metodoPagoId,
    metodoPago: metodoPagoNombre,
    moneda,
    cicloPago: input.periodoRenovacion as VentaDoc['cicloPago'],
    fechaInicio: input.fechaInicio,
    fechaVencimiento: input.fechaVencimiento,
    notas: notaPrincipal,
  });

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

  return { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda, syncPaymentMethodFailed };
}

export async function deleteVentaPagoUseCase(ventaId: string, pagoId: string) {
  await removePagoVenta(pagoId);
  const ventaActualizada = await getVentaConPagoActualUseCase(ventaId);

  if (ventaActualizada) {
    await updateVenta(ventaId, {
      fechaFin: ventaActualizada.fechaFin,
      fechaInicio: ventaActualizada.fechaInicio,
      cicloPago: ventaActualizada.cicloPago,
    });
  }

  return { ventaActualizada };
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
  },
  options: {
    currentVenta?: VentaDoc;
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
) {
  const result = await updateVentaUseCase(id, updates, options);
  const pagos = await queryPagosVenta<PagoVenta>([{ field: 'ventaId', operator: '==', value: id }]);

  if (pagos.length > 0) {
    const pagoMasReciente = [...pagos].sort((a, b) => {
      const dateA = a.fecha instanceof Date ? a.fecha : new Date(a.fecha);
      const dateB = b.fecha instanceof Date ? b.fecha : new Date(b.fecha);
      return dateB.getTime() - dateA.getTime();
    })[0];

    await updatePagoVenta(pagoMasReciente.id, pagoUpdates);
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

  await updateVenta(id, finalUpdates);

  const precioAnterior = ventaAnterior.precioFinal || 0;
  const precioNuevo = updates.precioFinal !== undefined ? updates.precioFinal : precioAnterior;
  const categoriaAnterior = ventaAnterior.categoriaId;
  const categoriaNueva = updates.categoriaId || categoriaAnterior;
  const estadoAnterior = ventaAnterior.estado || 'activo';
  const estadoNuevo = updates.estado || estadoAnterior;

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
    accion: 'actualizacion',
    entidad: 'venta',
    entidadId: id,
    entidadNombre: (ventaAnterior.clienteNombre && ventaAnterior.servicioNombre)
      ? `${ventaAnterior.clienteNombre} - ${ventaAnterior.servicioNombre}`
      : '',
    detalles: `Venta actualizada: ${ventaAnterior.clienteNombre ?? '-'} / ${ventaAnterior.servicioNombre ?? '-'}`,
    cambios: cambios.length > 0 ? cambios : undefined,
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
    const pagos = await queryPagosVenta<PagoVenta>([{ field: 'ventaId', operator: '==', value: id }]);
    await Promise.all(pagos.map((pago) => removePagoVenta(pago.id)));
  }

  await removeVenta(id);

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
  });

  upsertVentaPronostico(null, id).catch((err) => {
    console.error('[VentasUseCases] Error removing pronostico:', err);
  });

  return { ventaEliminada, serviceProfileDelta };
}
