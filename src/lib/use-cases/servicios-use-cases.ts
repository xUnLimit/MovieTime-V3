import { getMetodoPagoById } from '@/lib/supabase/catalogos-repository';
import {
  createServicioWithInitialPayment,
  getPagoServicioById,
  getServicioById,
  queryPagosServicio,
  removePagoServicio,
  removeServicio,
  removeServicioWithPayments,
  updateLatestServicioPeriodo,
  updateServicio,
  updateServicioPaymentAndPeriod,
} from '@/lib/supabase/servicios-repository';
import { toDateOnly, toIso } from '@/lib/supabase/dates';
import {
  adjustGastosStats,
  getDiaKeyFromDate,
  getMesKeyFromDate,
  upsertServicioPronostico,
} from '@/lib/services/dashboardStatsService';
import { crearPagoRenovacion } from '@/lib/services/pagosServicioService';
import { resyncServiciosDenormalizedData, syncServicioDependencias } from '@/lib/services/servicioSyncService';
import { sincronizarUnServicio } from '@/lib/services/notificationSyncService';
import { currencyService } from '@/lib/services/currencyService';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import { sumPaymentsInUSD } from '@/lib/utils/payments';
import { safeAsyncSideEffect, toMoneyNumber } from '@/lib/utils/safety';
import { getCurrencySymbol } from '@/lib/constants';
import type { ActivityLog, MetodoPago, PagoServicio, Servicio } from '@/types';
import type { ServicioPronostico } from '@/types/dashboard';

export * from '@/lib/use-cases/servicios/servicios-query-use-cases';

type RecordActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
type LogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;

type ServicioPagoInput = {
  periodoRenovacion: string;
  metodoPagoId: string;
  costo: number;
  descuento?: number;
  fechaInicio: Date;
  fechaVencimiento: Date;
  notas?: string;
  metodoPagoNombre?: string;
  moneda?: string;
  renovacionAutomatica?: boolean;
};

function normalizeServicioPagoInput(
  input: ServicioPagoInput,
  metodoPago?: MetodoPago | null,
  fallbackMoneda = 'USD'
) {
  return {
    notaPrincipal: input.notas?.trim() ?? '',
    metodoPagoNombre: input.metodoPagoNombre || metodoPago?.nombre || '',
    moneda: input.moneda || metodoPago?.moneda || fallbackMoneda || 'USD',
    cicloPago: input.periodoRenovacion as 'mensual' | 'trimestral' | 'semestral' | 'anual',
  };
}

const SERVICIO_TABLE_UPDATE_KEYS = new Set([
  'categoriaId',
  'tipo',
  'nombre',
  'correo',
  'contrasena',
  'perfilesDisponibles',
  'activo',
  'enReposo',
  'diasReposo',
  'fechaInicioReposo',
  'fechaFinReposo',
  'cortadoAt',
  'cortadoBy',
  'motivoCorte',
  'archivadoAt',
  'archivadoBy',
  'motivoArchivado',
  'notas',
  'createdBy',
]);

function getServicioTableUpdates(updates: Partial<Servicio>): Partial<Servicio> {
  const result: Partial<Servicio> = {};
  const source = updates as Record<string, unknown>;
  const target = result as Record<string, unknown>;
  for (const key of SERVICIO_TABLE_UPDATE_KEYS) {
    if (source[key] !== undefined) target[key] = source[key];
  }
  return result;
}

function hasServicioPeriodoUpdates(updates: Partial<Servicio>): boolean {
  return [
    'costoServicio',
    'moneda',
    'cicloPago',
    'fechaInicio',
    'fechaVencimiento',
    'renovacionAutomatica',
    'metodoPagoId',
  ].some((key) => (updates as Record<string, unknown>)[key] !== undefined);
}

async function getUsdValues(amount: number, moneda: string) {
  const normalizedAmount = toMoneyNumber(amount);
  const usd = await currencyService.convertToUSD(normalizedAmount, moneda);
  return {
    usd,
    rate: moneda === 'USD' || normalizedAmount === 0 || usd === 0 ? 1 : normalizedAmount / usd,
  };
}

export function toServicioPronostico(s: Servicio): ServicioPronostico | null {
  if (!s.activo || s.enReposo || !s.fechaVencimiento || !s.cicloPago || s.costoServicio <= 0) return null;
  return {
    id: s.id,
    fechaVencimiento: s.fechaVencimiento instanceof Date
      ? s.fechaVencimiento.toISOString()
      : String(s.fechaVencimiento),
    cicloPago: s.cicloPago,
    costoServicio: s.costoServicio,
    moneda: s.moneda || 'USD',
  };
}

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
  if (!servicio) throw new Error('Servicio not found');

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
  if (!servicio) throw new Error('Servicio not found');

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

export async function renewServicioUseCase(
  servicio: Servicio,
  input: ServicioPagoInput,
  options: {
    numeroRenovacion?: number;
    metodoPago?: MetodoPago | null;
    logContext?: LogContext;
    recordActivityLog?: RecordActivityLog;
    logPrefix?: string;
  }
) {
  const { notaPrincipal, metodoPagoNombre, moneda, cicloPago } = normalizeServicioPagoInput(
    input,
    options.metodoPago,
    servicio.moneda
  );
  const renovacionAutomatica = input.renovacionAutomatica ?? servicio.renovacionAutomatica ?? false;

  const numeroRenovacion = options.numeroRenovacion ?? (
    await queryPagosServicio<PagoServicio>([{ field: 'servicioId', operator: '==', value: servicio.id }])
  ).filter((pago) => !pago.isPagoInicial && pago.descripcion !== 'Pago inicial').length + 1;

  await crearPagoRenovacion(
    servicio.id,
    servicio.categoriaId || '',
    input.costo,
    input.metodoPagoId,
    metodoPagoNombre,
    moneda,
    cicloPago,
    input.fechaInicio,
    input.fechaVencimiento,
    numeroRenovacion,
    notaPrincipal,
    renovacionAutomatica
  );

  safeAsyncSideEffect(adjustGastosStats({
    delta: input.costo,
    moneda,
    mes: getMesKeyFromDate(input.fechaInicio),
    dia: getDiaKeyFromDate(input.fechaInicio),
    categoriaId: servicio.categoriaId,
    categoriaNombre: servicio.categoriaNombre,
  }), {
    operation: 'adjustGastosStats',
    entity: 'servicio',
    entityId: servicio.id,
  });

  const pronostico = {
    id: servicio.id,
    fechaVencimiento: input.fechaVencimiento.toISOString(),
    cicloPago: input.periodoRenovacion,
    costoServicio: input.costo,
    moneda,
  };
  safeAsyncSideEffect(upsertServicioPronostico(pronostico, servicio.id), {
    operation: 'upsertServicioPronostico',
    entity: 'servicio',
    entityId: servicio.id,
  });

  await updateServicio(servicio.id, getServicioTableUpdates({ notas: notaPrincipal }));

  await options.recordActivityLog?.({
    ...(options.logContext ?? { usuarioId: 'sistema', usuarioEmail: 'sistema' }),
    accion: 'renovacion',
    entidad: 'servicio',
    entidadId: servicio.id,
    entidadNombre: `${servicio.nombre} [${servicio.correo}]`,
    detalles: `${options.logPrefix ?? 'Servicio renovado'}: "${servicio.nombre}" [${servicio.correo}] - ${getCurrencySymbol(moneda)}${input.costo} - hasta ${input.fechaVencimiento.toLocaleDateString('es-PA')} (${input.periodoRenovacion})`,
    metadata: {
      costoServicio: input.costo,
      moneda,
      cicloPago: input.periodoRenovacion,
      fechaInicio: toDateOnly(input.fechaInicio),
      fechaVencimiento: toDateOnly(input.fechaVencimiento),
      numeroRenovacion,
      origen: 'renewServicioUseCase',
    },
  });

  return {
    servicioActualizado: {
      ...servicio,
      fechaInicio: input.fechaInicio,
      fechaVencimiento: input.fechaVencimiento,
      costoServicio: input.costo,
      metodoPagoId: input.metodoPagoId || undefined,
      metodoPagoNombre,
      moneda,
      cicloPago,
      renovacionAutomatica,
      notas: notaPrincipal,
      updatedAt: new Date(),
    } as Servicio,
    pronostico,
  };
}

export async function updateServicioPagoUseCase(
  servicio: Servicio,
  pago: PagoServicio,
  input: ServicioPagoInput,
  options: {
    metodoPago?: MetodoPago | null;
    isLatestPayment: boolean;
  }
) {
  const { notaPrincipal, metodoPagoNombre, moneda, cicloPago } = normalizeServicioPagoInput(
    input,
    options.metodoPago,
    pago.moneda || servicio.moneda
  );
  const { usd, rate } = await getUsdValues(input.costo, moneda);
  const pagoActual = await getPagoServicioById<PagoServicio & { servicioPeriodoId?: string }>(pago.id);

  if (pagoActual?.servicioPeriodoId) {
    await updateServicioPaymentAndPeriod(pago.id, {
      fechaInicio: input.fechaInicio,
      fechaVencimiento: input.fechaVencimiento,
      cicloPago,
      costo: input.costo,
      moneda,
      costoUsd: usd,
      exchangeRate: rate,
      renovacionAutomatica: servicio.renovacionAutomatica,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre,
      notas: notaPrincipal,
    });
  }

  let servicioActualizado: Servicio | null = null;
  if (options.isLatestPayment) {
    servicioActualizado = await getServicioById<Servicio>(servicio.id);
    const pronostico = servicioActualizado ? toServicioPronostico(servicioActualizado) : null;
    safeAsyncSideEffect(upsertServicioPronostico(pronostico, servicio.id), {
      operation: 'upsertServicioPronostico',
      entity: 'servicio',
      entityId: servicio.id,
    });
  }

  return { servicioActualizado };
}

export async function deleteServicioPagoUseCase(
  servicio: Servicio,
  pago: PagoServicio,
  _remainingPayments: PagoServicio[],
  options: {
    isLatestPayment: boolean;
    fallbackMoneda?: string;
  }
) {
  void _remainingPayments;
  await removePagoServicio(pago.id);

  safeAsyncSideEffect(adjustGastosStats({
    delta: -(pago.monto ?? 0),
    moneda: pago.moneda || options.fallbackMoneda || 'USD',
    mes: getMesKeyFromDate(pago.fecha ?? new Date()),
    dia: getDiaKeyFromDate(pago.fecha ?? new Date()),
    categoriaId: servicio.categoriaId,
    categoriaNombre: servicio.categoriaNombre,
  }), {
    operation: 'adjustGastosStats',
    entity: 'servicio',
    entityId: servicio.id,
  });

  let servicioActualizado: Servicio | null = null;
  if (options.isLatestPayment) {
    servicioActualizado = await getServicioById<Servicio>(servicio.id);
    const pronostico = servicioActualizado ? toServicioPronostico(servicioActualizado) : null;
    safeAsyncSideEffect(upsertServicioPronostico(pronostico, servicio.id), {
      operation: 'upsertServicioPronostico',
      entity: 'servicio',
      entityId: servicio.id,
    });
    safeAsyncSideEffect(sincronizarUnServicio(servicio.id), {
      operation: 'sincronizarUnServicio',
      entity: 'servicio',
      entityId: servicio.id,
    });
  }

  return { servicioActualizado };
}

export const resyncServicioReferenciasUseCase = resyncServiciosDenormalizedData;
