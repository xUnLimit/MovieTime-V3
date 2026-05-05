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
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
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
