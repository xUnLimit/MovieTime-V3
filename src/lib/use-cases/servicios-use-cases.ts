import { getMetodoPagoById } from '@/lib/supabase/catalogos-repository';
import { countCategorias } from '@/lib/supabase/categorias-repository';
import {
  adjustCategoriaGastos,
  countServicios,
  createServicio,
  getServicioById,
  queryPagosServicio,
  queryServicios,
  removePagoServicio,
  removeServicio,
  updateServicio,
} from '@/lib/supabase/servicios-repository';
import {
  adjustGastosStats,
  getDiaKeyFromDate,
  getMesKeyFromDate,
  upsertServicioPronostico,
} from '@/lib/services/dashboardStatsService';
import { crearPagoInicial } from '@/lib/services/pagosServicioService';
import { resyncServiciosDenormalizedData, syncServicioDependencias } from '@/lib/services/servicioSyncService';
import { sincronizarUnServicio } from '@/lib/services/notificationSyncService';
import { currencyService } from '@/lib/services/currencyService';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import type { ActivityLog, MetodoPago, Servicio } from '@/types';
import type { ServicioPronostico } from '@/types/dashboard';

type RecordActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
type LogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;

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

export async function fetchServiciosCountsUseCase() {
  const [totalServiciosRaw, serviciosEnReposo, serviciosActivosRaw, serviciosEnReposoDocs, totalCategoriasActivas] =
    await Promise.all([
      countServicios([]),
      countServicios([{ field: 'enReposo', operator: '==', value: true }]),
      countServicios([{ field: 'activo', operator: '==', value: true }]),
      queryServicios<Servicio>([{ field: 'enReposo', operator: '==', value: true }]),
      countCategorias([{ field: 'activo', operator: '==', value: true }]),
    ]);

  const serviciosActivosEnReposo = serviciosEnReposoDocs.filter((servicio) => servicio.activo).length;
  return {
    totalServicios: Math.max(0, totalServiciosRaw - serviciosEnReposo),
    serviciosActivos: Math.max(0, serviciosActivosRaw - serviciosActivosEnReposo),
    totalCategoriasActivas,
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

  const id = await createServicio({
    ...servicioData,
    metodoPagoNombre,
    moneda,
    perfilesOcupados: 0,
    gastosTotal: servicioData.costoServicio ?? 0,
  });

  await crearPagoInicial(
    id,
    servicioData.categoriaId,
    servicioData.costoServicio ?? 0,
    servicioData.metodoPagoId || '',
    metodoPagoNombre || '',
    moneda || 'USD',
    servicioData.cicloPago ?? 'mensual',
    servicioData.fechaInicio ?? new Date(),
    servicioData.fechaVencimiento ?? new Date(),
    servicioData.notas
  );

  if (servicioData.costoServicio) {
    const costoUSD = await currencyService.convertToUSD(servicioData.costoServicio, moneda ?? 'USD');
    await adjustCategoriaGastos(servicioData.categoriaId, costoUSD);
  }

  adjustGastosStats({
    delta: servicioData.costoServicio ?? 0,
    moneda: moneda ?? 'USD',
    mes: getMesKeyFromDate(servicioData.fechaInicio ?? new Date()),
    dia: getDiaKeyFromDate(servicioData.fechaInicio ?? new Date()),
    categoriaId: servicioData.categoriaId,
    categoriaNombre: servicioData.categoriaNombre,
  }).catch((err) => console.error('[ServiciosUseCases] Error updating dashboard gastos:', err));

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
  upsertServicioPronostico(pronostico, id).catch((err) => {
    console.error('[ServiciosUseCases] Error upserting pronostico:', err);
  });

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'creacion',
    entidad: 'servicio',
    entidadId: id,
    entidadNombre: `${servicioData.nombre} [${servicioData.correo}]`,
    detalles: `Servicio creado: "${servicioData.nombre}" [${servicioData.correo}] (${servicioData.tipo}) - $${servicioData.costoServicio ?? 0} ${moneda ?? 'USD'} (${servicioData.cicloPago ?? 'mensual'})`,
  });

  sincronizarUnServicio(id).catch(() => {});

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

  await updateServicio(id, finalUpdates);

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
    (updates.activo !== undefined && updates.activo !== servicio.activo) ||
    (updates.enReposo !== undefined && updates.enReposo !== servicio.enReposo);
  const pronostico = shouldSyncPronostico ? toServicioPronostico(servicioActualizado) : undefined;
  if (shouldSyncPronostico) {
    upsertServicioPronostico(pronostico ?? null, id).catch(() => {});
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

  let gastosRealUSD = 0;
  const pagosActuales = await queryPagosServicio<{ id: string; monto: number; moneda?: string }>([
    { field: 'servicioId', operator: '==', value: id },
  ]);
  await Promise.all(
    pagosActuales.map(async (pago) => {
      gastosRealUSD += await currencyService.convertToUSD(pago.monto, pago.moneda ?? 'USD');
    })
  );

  if (options.deletePayments) {
    await Promise.all(pagosActuales.map((pago) => removePagoServicio(pago.id)));
  }

  await removeServicio(id);

  if (gastosRealUSD > 0) {
    await adjustCategoriaGastos(servicio.categoriaId, -gastosRealUSD);
  }

  if (servicio.costoServicio) {
    adjustGastosStats({
      delta: -servicio.costoServicio,
      moneda: servicio.moneda ?? 'USD',
      mes: getMesKeyFromDate(servicio.fechaInicio ?? new Date()),
      dia: getDiaKeyFromDate(servicio.fechaInicio ?? new Date()),
      categoriaId: servicio.categoriaId,
      categoriaNombre: servicio.categoriaNombre,
    }).catch((err) => console.error('[ServiciosUseCases] Error reverting dashboard gastos:', err));
  }

  upsertServicioPronostico(null, id).catch((err) => {
    console.error('[ServiciosUseCases] Error removing pronostico:', err);
  });

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'eliminacion',
    entidad: 'servicio',
    entidadId: id,
    entidadNombre: `${servicio.nombre} [${servicio.correo}]`,
    detalles: `Servicio eliminado: "${servicio.nombre}" (${servicio.correo})`,
  });

  return { servicio };
}

export const resyncServicioReferenciasUseCase = resyncServiciosDenormalizedData;
