import { format } from 'date-fns';

import { NotFoundError, ValidationError } from '@/platform/errors/domain-errors';
import { getMetodoPagoById } from '@/platform/supabase/catalogos-repository';
import { toDateOnly, toIso } from '@/platform/supabase/dates';
import {
  createVenta,
  createVentaWithInitialPayment,
  getVentaById,
  removeVenta,
  removeVentaWithPayments,
  updateVenta,
} from '@/platform/supabase/ventas-repository';
import { storeEventBus } from '@/platform/events/store-event-bus';
import { detectarCambios } from '@/platform/utils/activityLogHelpers';
import type { MetodoPago, VentaDoc } from '@/types';
import {
  getUsdValues,
  getVentaTableUpdates,
  nullableMetodoPagoId,
  toVentaPronostico,
  type LogContext,
  type RecordActivityLog,
  type VentaInput,
} from '@/application/use-cases/ventas/ventas-shared';

export async function createVentaUseCase(
  ventaData: VentaInput,
  options: { logContext: LogContext; recordActivityLog?: RecordActivityLog }
) {
  if (!ventaData.planId || !ventaData.planNombre) {
    throw new ValidationError('Una venta debe tener un plan seleccionado.');
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

  const pronostico = toVentaPronostico(venta);

  storeEventBus.emit({ type: 'VENTA_CREATED', ventaId });

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
  if (!ventaAnterior) throw new NotFoundError('Venta no encontrada', { ventaId: id });

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

  const estadoAnterior = ventaAnterior.estado || 'activo';
  const estadoNuevo = updates.estado || estadoAnterior;
  const esCorteVenta = estadoAnterior !== estadoNuevo && estadoNuevo === 'inactivo';

  let serviceProfileDelta: { servicioId: string; shouldIncrement: boolean } | null = null;

  if (updates.estado !== undefined && estadoAnterior !== estadoNuevo) {
    if (ventaAnterior.servicioId) {
      serviceProfileDelta = {
        servicioId: ventaAnterior.servicioId,
        shouldIncrement: estadoAnterior === 'inactivo',
      };
    }
  }

  const ventaActualizada = {
    ...ventaAnterior,
    ...finalUpdates,
    updatedAt: new Date(),
  } as VentaDoc;
  const cambios = detectarCambios(
    'venta',
    ventaAnterior,
    ventaActualizada
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

  storeEventBus.emit({ type: 'VENTA_UPDATED', ventaId: id });

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

  storeEventBus.emit({ type: 'VENTA_DELETED', ventaId: id });

  return { ventaEliminada, serviceProfileDelta };
}
