import { NotFoundError } from '@/lib/errors/domain-errors';
import { getMetodoPagoById } from '@/lib/supabase/catalogos-repository';
import {
  createServicioWithInitialPayment,
  getServicioById,
  queryPagosServicio,
  removeServicio,
  removeServicioWithPayments,
  updateLatestServicioPeriodo,
  updateServicio,
} from '@/lib/supabase/servicios-repository';
import { toDateOnly, toIso } from '@/lib/supabase/dates';
import {
  adjustGastosStats,
  getDiaKeyFromDate,
  getMesKeyFromDate,
  upsertServicioPronostico,
} from '@/lib/services/dashboardStatsService';
import { resyncServiciosDenormalizedData, syncServicioDependencias } from '@/lib/services/servicioSyncService';
import { sincronizarUnServicio } from '@/lib/services/notificationSyncService';
import { currencyService } from '@/lib/services/currencyService';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import { sumPaymentsInUSD } from '@/lib/utils/payments';
import { safeAsyncSideEffect } from '@/lib/utils/safety';
import type { MetodoPago, Servicio } from '@/types';
import {
  getServicioTableUpdates,
  getUsdValues,
  hasServicioPeriodoUpdates,
  toServicioPronostico,
  type LogContext,
  type RecordActivityLog,
} from '@/lib/use-cases/servicios/servicios-shared';

export async function createServicioUseCase(
  servicioData: Omit<Servicio, 'id' | 'createdAt' | 'updatedAt' | 'perfilesOcupados'>,
  options: { logContext: LogContext; recordActivityLog?: RecordActivityLog }
) {
  let metodoPagoNombre: string | undefined;
  let moneda: string | undefined;
  if (servicioData.metodoPagoId) {
    const metodoPago = await getMetodoPagoById<MetodoPago>(servicioData.metodoPagoId);
    metodoPagoNombre = metodoPago?.nombre;
    moneda = metodoPago?.moneda;
  }

  const costo = Number(servicioData.costoServicio ?? 0);
  const monedaOriginal = moneda || 'USD';
  const { usd, rate } = await getUsdValues(costo, monedaOriginal);
  const id = await createServicioWithInitialPayment({
    p_categoria_id: servicioData.categoriaId,
    p_plan_tipo_id: servicioData.tipo || null,
    p_nombre: servicioData.nombre,
    p_correo: servicioData.correo,
    p_contrasena: servicioData.contrasena,
    p_perfiles_disponibles: servicioData.perfilesDisponibles ?? 0,
    p_perfiles_ocupados: 0,
    p_activo: servicioData.activo ?? true,
    p_en_reposo: servicioData.enReposo ?? false,
    p_dias_reposo: servicioData.diasReposo ?? null,
    p_fecha_inicio_reposo: servicioData.fechaInicioReposo ? toDateOnly(servicioData.fechaInicioReposo) : null,
    p_fecha_fin_reposo: servicioData.fechaFinReposo ? toDateOnly(servicioData.fechaFinReposo) : null,
    p_notas: servicioData.notas ?? null,
    p_fecha_inicio: toDateOnly(servicioData.fechaInicio ?? new Date()),
    p_fecha_vencimiento: toDateOnly(servicioData.fechaVencimiento ?? new Date()),
    p_ciclo_pago: servicioData.cicloPago ?? 'mensual',
    p_costo_original: costo,
    p_moneda_original: monedaOriginal,
    p_costo_usd: usd,
    p_exchange_rate: rate,
    p_renovacion_automatica: servicioData.renovacionAutomatica ?? false,
    p_metodo_pago_id: servicioData.metodoPagoId || null,
    p_metodo_pago_nombre_snapshot: metodoPagoNombre || null,
    p_fecha_pago: toIso(new Date()),
    p_pago_notas: servicioData.notas ?? '',
  });

  safeAsyncSideEffect(adjustGastosStats({
    delta: servicioData.costoServicio ?? 0,
    moneda: moneda ?? 'USD',
    mes: getMesKeyFromDate(servicioData.fechaInicio ?? new Date()),
    dia: getDiaKeyFromDate(servicioData.fechaInicio ?? new Date()),
    categoriaId: servicioData.categoriaId,
    categoriaNombre: servicioData.categoriaNombre,
  }), {
    operation: 'adjustGastosStats',
    entity: 'servicio',
    entityId: id,
  });

  const servicio = {
    ...servicioData,
    id,
    metodoPagoNombre,
    moneda,
    perfilesOcupados: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Servicio;

  const pronostico = toServicioPronostico(servicio);
  safeAsyncSideEffect(upsertServicioPronostico(pronostico, id), {
    operation: 'upsertServicioPronostico',
    entity: 'servicio',
    entityId: id,
  });

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'creacion',
    entidad: 'servicio',
    entidadId: id,
    entidadNombre: `${servicioData.nombre} [${servicioData.correo}]`,
    detalles: `Servicio creado: "${servicioData.nombre}" [${servicioData.correo}] (${servicioData.tipo}) - $${servicioData.costoServicio ?? 0} ${moneda ?? 'USD'} (${servicioData.cicloPago ?? 'mensual'})`,
    metadata: {
      costoServicio: costo,
      moneda: monedaOriginal,
      cicloPago: servicioData.cicloPago ?? 'mensual',
      categoriaId: servicioData.categoriaId,
      fechaInicio: toDateOnly(servicioData.fechaInicio ?? new Date()),
      fechaVencimiento: toDateOnly(servicioData.fechaVencimiento ?? new Date()),
      origen: 'createServicioUseCase',
    },
  });

  safeAsyncSideEffect(sincronizarUnServicio(id), {
    operation: 'sincronizarUnServicio',
    entity: 'servicio',
    entityId: id,
  });

  return { servicio, pronostico };
}

export async function updateServicioUseCase(
  id: string,
  updates: Partial<Servicio>,
  options: { logContext: LogContext; recordActivityLog?: RecordActivityLog }
) {
  const servicio = await getServicioById<Servicio>(id);
  if (!servicio) throw new NotFoundError('Servicio not found', { servicioId: id });

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

  await updateServicio(id, getServicioTableUpdates(finalUpdates));

  const shouldSyncPeriodo = hasServicioPeriodoUpdates(finalUpdates);
  if (shouldSyncPeriodo) {
    const nextCosto = Number(finalUpdates.costoServicio ?? servicio.costoServicio ?? 0);
    const nextMoneda = finalUpdates.moneda ?? servicio.moneda ?? 'USD';
    const { usd, rate } = await getUsdValues(nextCosto, nextMoneda);
    await updateLatestServicioPeriodo(id, {
      fechaInicio: finalUpdates.fechaInicio ?? servicio.fechaInicio ?? new Date(),
      fechaVencimiento: finalUpdates.fechaVencimiento ?? servicio.fechaVencimiento ?? new Date(),
      cicloPago: (finalUpdates.cicloPago ?? servicio.cicloPago ?? 'mensual') as NonNullable<Servicio['cicloPago']>,
      costo: nextCosto,
      moneda: nextMoneda,
      costoUsd: usd,
      exchangeRate: rate,
      renovacionAutomatica: finalUpdates.renovacionAutomatica ?? servicio.renovacionAutomatica,
    });
  }

  const servicioActualizado = {
    ...servicio,
    ...finalUpdates,
    updatedAt: new Date(),
  } as Servicio;

  await syncServicioDependencias(
    {
      id: servicio.id,
      nombre: servicio.nombre,
      correo: servicio.correo,
      contrasena: servicio.contrasena,
      categoriaId: servicio.categoriaId,
      categoriaNombre: servicio.categoriaNombre,
    },
    {
      id: servicioActualizado.id,
      nombre: servicioActualizado.nombre,
      correo: servicioActualizado.correo,
      contrasena: servicioActualizado.contrasena,
      categoriaId: servicioActualizado.categoriaId,
      categoriaNombre: servicioActualizado.categoriaNombre,
    }
  );

  const shouldSyncPronostico =
    shouldSyncPeriodo ||
    (updates.activo !== undefined && updates.activo !== servicio.activo) ||
    (updates.enReposo !== undefined && updates.enReposo !== servicio.enReposo);
  const pronostico = shouldSyncPronostico ? toServicioPronostico(servicioActualizado) : undefined;
  if (shouldSyncPronostico) {
    safeAsyncSideEffect(upsertServicioPronostico(pronostico ?? null, id), {
      operation: 'upsertServicioPronostico',
      entity: 'servicio',
      entityId: id,
    });
  }

  const cambios = detectarCambios(
    'servicio',
    servicio as unknown as Record<string, unknown>,
    servicioActualizado as unknown as Record<string, unknown>
  );

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'actualizacion',
    entidad: 'servicio',
    entidadId: id,
    entidadNombre: `${servicio.nombre} [${servicio.correo}]`,
    detalles: `Servicio actualizado: "${servicio.nombre}" [${servicio.correo}]`,
    cambios: cambios.length > 0 ? cambios : undefined,
    metadata: {
      cambiosCount: cambios.length,
      origen: 'updateServicioUseCase',
    },
  });

  return { servicioAnterior: servicio, servicioActualizado, finalUpdates, pronostico };
}

export async function deleteServicioUseCase(
  id: string,
  options: {
    deletePayments?: boolean;
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
) {
  const servicio = await getServicioById<Servicio>(id);
  if (!servicio) throw new NotFoundError('Servicio not found', { servicioId: id });

  const pagosActuales = await queryPagosServicio<{ id: string; monto: number; moneda?: string }>([
    { field: 'servicioId', operator: '==', value: id },
  ]);
  const gastosRealUSD = await sumPaymentsInUSD(
    pagosActuales,
    (monto, moneda) => currencyService.convertToUSD(monto, moneda)
  );

  if (options.deletePayments) {
    await removeServicioWithPayments(id, true);
  } else {
    await removeServicio(id);
  }

  if (servicio.costoServicio) {
    safeAsyncSideEffect(adjustGastosStats({
      delta: -servicio.costoServicio,
      moneda: servicio.moneda ?? 'USD',
      mes: getMesKeyFromDate(servicio.fechaInicio ?? new Date()),
      dia: getDiaKeyFromDate(servicio.fechaInicio ?? new Date()),
      categoriaId: servicio.categoriaId,
      categoriaNombre: servicio.categoriaNombre,
    }), {
      operation: 'adjustGastosStats',
      entity: 'servicio',
      entityId: id,
    });
  }

  safeAsyncSideEffect(upsertServicioPronostico(null, id), {
    operation: 'removeServicioPronostico',
    entity: 'servicio',
    entityId: id,
  });

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'eliminacion',
    entidad: 'servicio',
    entidadId: id,
    entidadNombre: `${servicio.nombre} [${servicio.correo}]`,
    detalles: `Servicio eliminado: "${servicio.nombre}" (${servicio.correo})`,
    metadata: {
      gastosRealUSD,
      categoriaId: servicio.categoriaId,
      deletePayments: options.deletePayments ?? false,
      origen: 'deleteServicioUseCase',
    },
  });

  return { servicio };
}

export const resyncServicioReferenciasUseCase = resyncServiciosDenormalizedData;
