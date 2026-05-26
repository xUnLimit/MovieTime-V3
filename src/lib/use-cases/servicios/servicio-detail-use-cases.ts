import { getMetodoPagoRead, getServicioRead, getVentaDetalleRead } from '@/lib/supabase/domain-read-adapters';
import { getVentaById, queryVentas } from '@/lib/supabase/ventas-repository';
import { invalidateDashboardCache, refreshCategoriasCache } from '@/lib/commands/client-cache';
import { getActivityLogOptions } from '@/lib/activity/activity-log-writer';
import { getTerceroUseCase } from '@/lib/use-cases/terceros-use-cases';
import { updateVentaUseCase } from '@/lib/use-cases/ventas/ventas-write-use-cases';
import {
  deleteServicioPagoUseCase,
  renewServicioUseCase,
  updateServicioPagoUseCase,
} from '@/lib/use-cases/servicios/servicios-payment-use-cases';
import type { MetodoPago, PagoServicio, Servicio, Tercero, VentaDoc } from '@/types';

export interface PerfilVentaDetalle {
  ventaId?: string;
  clienteId?: string;
  perfilNumero?: number | null;
  clienteNombre?: string;
  clienteTelefono?: string;
  createdAt?: Date;
  precioFinal?: number;
  descuento?: number;
  fechaInicio?: Date;
  fechaFin?: Date;
  notas?: string;
  servicioNombre?: string;
  servicioCorreo?: string;
  moneda?: string;
  perfilNombre?: string;
  codigo?: string;
  cicloPago?: string;
}

export type CategoriaDetalle = Pick<Servicio, 'categoriaId' | 'categoriaNombre'>;
export type MetodoPagoDetalle = Pick<MetodoPago, 'id' | 'nombre' | 'moneda'> & Partial<MetodoPago>;

type ServicioDetalleWorkflowDeps = {
  deleteNotificacionesPorServicio: (servicioId: string) => Promise<void>;
  deleteNotificacionesPorVenta: (ventaId: string) => Promise<void>;
  deleteServicio: (servicioId: string, deletePayments?: boolean) => Promise<void>;
  invalidateCategorias: () => Promise<unknown>;
  invalidateNotifications: () => Promise<unknown>;
  refreshCounts: () => Promise<unknown>;
  refreshPagos: () => Promise<unknown> | unknown;
  updatePerfilOcupado: (servicioId: string, shouldIncrement: boolean) => Promise<void>;
};

type ServicioPagoWorkflowInput = {
  costo: number;
  metodoPagoId: string;
  metodoPagoNombre?: string;
  moneda?: string;
  periodoRenovacion: string;
  fechaInicio: Date;
  fechaVencimiento: Date;
  nota?: string;
  renovacionAutomatica?: boolean;
};

export type ServicioDetalleWorkflowOutcome =
  | { type: 'servicioDeleted'; deletedPayments: boolean }
  | { type: 'servicioPaymentUpdated'; servicioActualizado: Servicio | null }
  | { type: 'servicioPaymentDeleted'; servicioActualizado: Servicio | null; latestPayment: boolean }
  | { type: 'servicioRenewed'; servicioActualizado: Servicio }
  | { type: 'servicioVentaCut'; ventaId: string; serviceProfileUpdated: boolean }
  | {
      type: 'servicioVentaTransferred';
      ventaId: string;
      targetServicioId: string;
      whatsappRequested: boolean;
      tercero?: Tercero | null;
    };

function toPerfilVenta(venta: VentaDoc): PerfilVentaDetalle {
  return {
    ventaId: venta.id || undefined,
    clienteId: venta.clienteId || undefined,
    perfilNumero: venta.perfilNumero ?? null,
    clienteNombre: venta.clienteNombre || undefined,
    clienteTelefono: venta.clienteTelefono || undefined,
    createdAt: venta.createdAt,
    precioFinal: venta.precioFinal ?? venta.precio ?? 0,
    descuento: venta.descuento ?? 0,
    fechaInicio: venta.fechaInicio ?? undefined,
    fechaFin: venta.fechaFin ?? undefined,
    notas: venta.notas || '',
    servicioNombre: venta.servicioNombre,
    servicioCorreo: venta.servicioCorreo || '',
    moneda: venta.moneda || undefined,
    perfilNombre: venta.perfilNombre || undefined,
    codigo: venta.codigo || undefined,
    cicloPago: venta.cicloPago || undefined,
  };
}

export async function fetchServicioVentasProfilesUseCase(id: string) {
  const ventasBase = await queryVentas<VentaDoc>([
    { field: 'servicioId', operator: '==', value: id },
  ]);

  return ventasBase
    .filter((venta) => (venta.estado ?? 'activo') !== 'inactivo')
    .map(toPerfilVenta);
}

export async function fetchVentaForServicioActionUseCase(ventaId: string): Promise<VentaDoc> {
  const venta = await getVentaDetalleRead(ventaId) ?? await getVentaById<VentaDoc>(ventaId);
  if (!venta) throw new Error('Venta no encontrada');
  return venta;
}

export async function fetchServicioDetalleBundleUseCase(id: string): Promise<{
  categoria: { id: string; nombre: string };
  metodoPago: MetodoPagoDetalle | null;
  servicio: Servicio;
}> {
  const servicio = await getServicioRead(id);
  if (!servicio) {
    throw new Error('Servicio no encontrado');
  }

  const metodoPagoReal = servicio.metodoPagoId
    ? await getMetodoPagoRead(servicio.metodoPagoId).catch(() => null)
    : null;

  return {
    servicio,
    categoria: {
      id: servicio.categoriaId,
      nombre: servicio.categoriaNombre,
    },
    metodoPago: servicio.metodoPagoId
      ? {
          id: servicio.metodoPagoId,
          nombre: metodoPagoReal?.nombre || servicio.metodoPagoNombre || '',
          moneda: metodoPagoReal?.moneda || servicio.moneda || 'USD',
          alias: metodoPagoReal?.alias,
          numeroTarjeta: metodoPagoReal?.numeroTarjeta,
        }
      : null,
  };
}

export async function deleteServicioDetalleWorkflow({
  deletePayments,
  deps,
  id,
}: {
  deletePayments: boolean;
  deps: Pick<ServicioDetalleWorkflowDeps, 'deleteServicio' | 'invalidateCategorias' | 'refreshCounts'>;
  id: string;
}): Promise<ServicioDetalleWorkflowOutcome> {
  await deps.deleteServicio(id, deletePayments);
  await Promise.all([
    deps.refreshCounts(),
    deps.invalidateCategorias(),
  ]);
  return { type: 'servicioDeleted', deletedPayments: deletePayments };
}

export async function updateServicioPagoDetalleWorkflow({
  data,
  metodosPago,
  pago,
  pagosOrdenados,
  servicio,
}: {
  data: ServicioPagoWorkflowInput;
  metodosPago: MetodoPago[];
  pago: PagoServicio;
  pagosOrdenados: PagoServicio[];
  servicio: Servicio;
}): Promise<ServicioDetalleWorkflowOutcome> {
  const metodoPagoSeleccionado = metodosPago.find((item) => item.id === data.metodoPagoId);
  const esUltimoPago = pagosOrdenados[0]?.id === pago.id;
  const { servicioActualizado } = await updateServicioPagoUseCase(
    servicio,
    pago,
    data,
    {
      metodoPago: metodoPagoSeleccionado,
      isLatestPayment: esUltimoPago,
    },
  );

  return { type: 'servicioPaymentUpdated', servicioActualizado };
}

export async function deleteServicioPagoDetalleWorkflow({
  deps,
  fallbackMoneda,
  id,
  pago,
  pagosOrdenados,
  pagosServicio,
  servicio,
}: {
  deps: Pick<ServicioDetalleWorkflowDeps, 'invalidateCategorias' | 'refreshPagos'>;
  fallbackMoneda?: string;
  id: string;
  pago: PagoServicio;
  pagosOrdenados: PagoServicio[];
  pagosServicio: PagoServicio[];
  servicio: Servicio;
}): Promise<ServicioDetalleWorkflowOutcome> {
  const eraUltimaRenovacion = pagosOrdenados[0]?.id === pago.id;
  const pagosActualizados = pagosServicio.filter((item) => item.id !== pago.id);
  const { servicioActualizado } = await deleteServicioPagoUseCase(
    servicio,
    pago,
    pagosActualizados,
    {
      isLatestPayment: eraUltimaRenovacion,
      fallbackMoneda,
    },
  );

  invalidateDashboardCache({ entity: 'servicio', entityId: id });
  refreshCategoriasCache({ entity: 'servicio', entityId: id });
  await deps.invalidateCategorias();
  await deps.refreshPagos();

  return {
    type: 'servicioPaymentDeleted',
    servicioActualizado,
    latestPayment: eraUltimaRenovacion,
  };
}

export async function renewServicioDetalleWorkflow({
  data,
  deps,
  id,
  metodosPago,
  renovaciones,
  servicio,
}: {
  data: ServicioPagoWorkflowInput;
  deps: Pick<ServicioDetalleWorkflowDeps, 'deleteNotificacionesPorServicio' | 'invalidateNotifications' | 'refreshPagos'>;
  id: string;
  metodosPago: MetodoPago[];
  renovaciones: number;
  servicio: Servicio;
}): Promise<ServicioDetalleWorkflowOutcome> {
  const metodoPagoSeleccionado = metodosPago.find((item) => item.id === data.metodoPagoId);
  const { servicioActualizado } = await renewServicioUseCase(servicio, data, {
    numeroRenovacion: renovaciones + 1,
    metodoPago: metodoPagoSeleccionado,
  });

  invalidateDashboardCache({ entity: 'servicio', entityId: id });
  deps.refreshPagos();
  await deps.deleteNotificacionesPorServicio(id);
  await deps.invalidateNotifications();
  refreshCategoriasCache({ entity: 'servicio', entityId: id });

  return { type: 'servicioRenewed', servicioActualizado };
}

export async function cutVentaFromServicioDetalleWorkflow({
  deps,
  motivoCorte,
  venta,
}: {
  deps: Pick<ServicioDetalleWorkflowDeps, 'deleteNotificacionesPorVenta' | 'invalidateNotifications' | 'updatePerfilOcupado'>;
  motivoCorte: string;
  venta: VentaDoc;
}): Promise<ServicioDetalleWorkflowOutcome> {
  const { serviceProfileDelta } = await updateVentaUseCase(
    venta.id,
    {
      estado: 'inactivo',
      cortadaAt: new Date(),
      motivoCorte,
    },
    {
      currentVenta: venta,
      ...getActivityLogOptions(),
    },
  );

  if (serviceProfileDelta) {
    await deps.updatePerfilOcupado(serviceProfileDelta.servicioId, serviceProfileDelta.shouldIncrement);
  }

  invalidateDashboardCache({ entity: 'venta', entityId: venta.id });
  await deps.deleteNotificacionesPorVenta(venta.id);
  await deps.invalidateNotifications();

  return {
    type: 'servicioVentaCut',
    ventaId: venta.id,
    serviceProfileUpdated: Boolean(serviceProfileDelta),
  };
}

export async function transferVentaFromServicioDetalleWorkflow({
  codigo,
  deps,
  notificarWhatsApp,
  perfilNombre,
  perfilNumero,
  targetServicio,
  venta,
}: {
  codigo?: string;
  deps: Pick<ServicioDetalleWorkflowDeps, 'invalidateNotifications' | 'updatePerfilOcupado'>;
  notificarWhatsApp: boolean;
  perfilNombre?: string;
  perfilNumero?: number | null;
  targetServicio: Servicio;
  venta: VentaDoc;
}): Promise<ServicioDetalleWorkflowOutcome> {
  await updateVentaUseCase(
    venta.id,
    {
      servicioId: targetServicio.id,
      perfilNumero,
      perfilNombre,
      codigo,
    },
    {
      currentVenta: venta,
      ...getActivityLogOptions(),
    },
  );

  if ((venta.estado ?? 'activo') !== 'inactivo') {
    await Promise.all([
      deps.updatePerfilOcupado(venta.servicioId, false),
      deps.updatePerfilOcupado(targetServicio.id, true),
    ]);
  }

  invalidateDashboardCache({ entity: 'venta', entityId: venta.id });
  await deps.invalidateNotifications();

  const tercero = notificarWhatsApp && venta.clienteId
    ? await getTerceroUseCase(venta.clienteId)
    : undefined;

  return {
    type: 'servicioVentaTransferred',
    ventaId: venta.id,
    targetServicioId: targetServicio.id,
    whatsappRequested: notificarWhatsApp,
    tercero,
  };
}
