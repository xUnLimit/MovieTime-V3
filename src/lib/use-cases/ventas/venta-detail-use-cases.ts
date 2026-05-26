import { CYCLE_MONTHS } from '@/lib/constants';
import { invalidateDashboardCache } from '@/lib/commands/client-cache';
import { syncVentaForecastReadModels } from '@/lib/forecasting';
import { getActivityLogOptions } from '@/lib/activity/activity-log-writer';
import { emitVentaUpdated } from '@/lib/events/cache-reactions';
import {
  getCategoriaPlanesRead,
  getServicioContrasenaRead,
  getVentaDetalleRead,
  queryMetodosPagoTercerosRead,
} from '@/lib/supabase/domain-read-adapters';
import { createVentaRefundUseCase } from '@/lib/use-cases/ventas/ventas-refund-use-cases';
import { getVentaConUltimoPagoUseCase } from '@/lib/use-cases/ventas/venta-current-payment-use-cases';
import {
  deleteVentaPagoUseCase,
  renewVentaUseCase,
  updateVentaPagoUseCase,
} from '@/lib/use-cases/ventas/ventas-payment-use-cases';
import { withPendingTerceroPaymentMethod } from '@/lib/utils/terceroMetodoPago';
import type { MetodoPago, PagoVenta, VentaDoc, VentaPago } from '@/types';
import type { Plan } from '@/types/categorias';

export interface VentaDetalleQueryData {
  servicioContrasena: string;
  venta: VentaDoc | null;
}

type VentaDetalleWorkflowDeps = {
  deleteNotificacionesPorVenta: (ventaId: string) => Promise<void>;
  deleteVenta: (ventaId: string, servicioId?: string, perfilNumero?: number | null, deletePagos?: boolean) => Promise<void>;
  invalidateNotifications: () => Promise<unknown>;
  refreshPagos: () => Promise<unknown> | unknown;
  updatePerfilOcupado: (servicioId: string, shouldIncrement: boolean) => Promise<void>;
};

type VentaPagoWorkflowInput = {
  costo: number;
  descuento?: number;
  metodoPagoId: string;
  metodoPagoNombre?: string;
  moneda?: string;
  periodoRenovacion: string;
  fechaInicio: Date;
  fechaVencimiento: Date;
  nota?: string;
  notificarWhatsApp?: boolean;
  planId?: string;
  planNombre?: string;
  planTipoNombre?: string;
};

type VentaRefundWorkflowInput = {
  monto: number;
  metodoPagoId: string;
  metodoPagoNombre?: string;
  destinoReembolso: string;
  moneda?: string;
  fecha: Date;
  nota?: string;
  cortarServicio: boolean;
  motivoCorte?: string;
};

export type VentaDetalleWorkflowOutcome =
  | { type: 'ventaDeleted'; deletedPayments: boolean }
  | {
      type: 'ventaRenewed';
      monto: number;
      syncPaymentMethodFailed: boolean;
      ventaActualizada: VentaDoc | null;
      whatsappRequested: boolean;
    }
  | {
      type: 'ventaRefunded';
      cut: boolean;
      ventaActualizada: VentaDoc | null;
    }
  | {
      type: 'ventaPaymentUpdated';
      syncPaymentMethodFailed: boolean;
      ventaActualizada: VentaDoc | null;
    }
  | {
      type: 'ventaPaymentDeleted';
      ventaActualizada: VentaDoc | null;
    };

export function getEstadoDetalle(venta: VentaDoc | null) {
  const esCortada = venta?.estado === 'inactivo' && !!venta?.cortadaAt;
  const estadoLabel = venta?.estado === 'inactivo' ? (esCortada ? 'Cortada' : 'Inactiva') : 'Activa';
  const estadoBadgeClass =
    venta?.estado === 'inactivo'
      ? (esCortada
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-600/20 dark:text-orange-400'
          : 'bg-red-100 text-red-700 dark:bg-red-600/20 dark:text-red-400')
      : 'bg-green-100 text-green-700 dark:bg-green-600/20 dark:text-green-400';

  return { esCortada, estadoBadgeClass, estadoLabel };
}

export async function fetchVentaDetalleQuery(id: string): Promise<VentaDetalleQueryData> {
  if (!id) return { venta: null, servicioContrasena: '' };

  const venta = await getVentaDetalleRead(id);
  if (!venta) return { venta: null, servicioContrasena: '' };

  const ventaConDatos = await getVentaConUltimoPagoUseCase(venta);
  const servicioContrasena = ventaConDatos.servicioId
    ? await getServicioContrasenaRead(ventaConDatos.servicioId).catch(() => '')
    : '';

  return { venta: ventaConDatos, servicioContrasena };
}

export async function deleteVentaDetalleWorkflow({
  deps,
  deletePagos,
  venta,
}: {
  deps: Pick<VentaDetalleWorkflowDeps, 'deleteVenta'>;
  deletePagos: boolean;
  venta: VentaDoc;
}): Promise<VentaDetalleWorkflowOutcome> {
  await deps.deleteVenta(venta.id, venta.servicioId, venta.perfilNumero, deletePagos);
  return { type: 'ventaDeleted', deletedPayments: deletePagos };
}

export async function renewVentaDetalleWorkflow({
  deps,
  id,
  input,
  metodosPago,
  venta,
}: {
  deps: Pick<VentaDetalleWorkflowDeps, 'deleteNotificacionesPorVenta' | 'invalidateNotifications' | 'refreshPagos'>;
  id: string;
  input: VentaPagoWorkflowInput;
  metodosPago: MetodoPago[];
  venta: VentaDoc;
}): Promise<VentaDetalleWorkflowOutcome> {
  const metodoPagoSeleccionado = metodosPago.find((metodo) => metodo.id === input.metodoPagoId);
  const renovacion = await renewVentaUseCase(venta, {
    ...input,
    metodoPagoNombre: metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
    moneda: input.moneda || metodoPagoSeleccionado?.moneda || venta.moneda,
  }, getActivityLogOptions());

  void renovacion.pronostico;
  syncVentaForecastReadModels(id);
  invalidateDashboardCache({ entity: 'venta', entityId: id });

  const { venta: ventaActualizada } = await fetchVentaDetalleQuery(id);
  deps.refreshPagos();
  await deps.deleteNotificacionesPorVenta(id);
  await deps.invalidateNotifications();
  emitVentaUpdated(id);

  return {
    type: 'ventaRenewed',
    monto: renovacion.monto,
    syncPaymentMethodFailed: renovacion.syncPaymentMethodFailed,
    ventaActualizada,
    whatsappRequested: Boolean(input.notificarWhatsApp),
  };
}

export async function refundVentaDetalleWorkflow({
  deps,
  id,
  input,
  venta,
}: {
  deps: Pick<VentaDetalleWorkflowDeps, 'deleteNotificacionesPorVenta' | 'invalidateNotifications' | 'refreshPagos' | 'updatePerfilOcupado'>;
  id: string;
  input: VentaRefundWorkflowInput;
  venta: VentaDoc;
}): Promise<VentaDetalleWorkflowOutcome> {
  const result = await createVentaRefundUseCase(
    venta,
    {
      ventaId: venta.id,
      monto: input.monto,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre: input.metodoPagoNombre ?? '',
      destinoReembolso: input.destinoReembolso,
      moneda: input.moneda ?? venta.moneda ?? 'USD',
      fecha: input.fecha,
      nota: input.nota,
      cortarServicio: input.cortarServicio,
      motivoCorte: input.motivoCorte,
    },
    getActivityLogOptions(),
  );

  if (result.serviceProfileDelta) {
    await deps.updatePerfilOcupado(
      result.serviceProfileDelta.servicioId,
      result.serviceProfileDelta.shouldIncrement,
    );
  }

  deps.refreshPagos();
  void result.pronostico;
  syncVentaForecastReadModels(id);
  invalidateDashboardCache({ entity: 'venta', entityId: id });

  if (input.cortarServicio) {
    await deps.deleteNotificacionesPorVenta(id);
    await deps.invalidateNotifications();
  }

  emitVentaUpdated(id);

  return {
    type: 'ventaRefunded',
    cut: input.cortarServicio,
    ventaActualizada: result.ventaActualizada ?? null,
  };
}

export async function updateVentaPagoDetalleWorkflow({
  id,
  input,
  metodosPago,
  pagoId,
  venta,
}: {
  id: string;
  input: VentaPagoWorkflowInput;
  metodosPago: MetodoPago[];
  pagoId: string;
  venta: VentaDoc;
}): Promise<VentaDetalleWorkflowOutcome> {
  const metodoPagoSeleccionado = metodosPago.find((metodo) => metodo.id === input.metodoPagoId);
  const updateResult = await updateVentaPagoUseCase(venta, pagoId, {
    ...input,
    metodoPagoNombre:
      input.metodoPagoNombre || metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
    moneda: input.moneda || metodoPagoSeleccionado?.moneda || venta.moneda,
  });

  const { venta: ventaActualizada } = await fetchVentaDetalleQuery(id);

  return {
    type: 'ventaPaymentUpdated',
    syncPaymentMethodFailed: updateResult.syncPaymentMethodFailed,
    ventaActualizada,
  };
}

export async function deleteVentaPagoDetalleWorkflow({
  id,
  pagoId,
}: {
  id: string;
  pagoId: string;
}): Promise<VentaDetalleWorkflowOutcome> {
  const { ventaActualizada } = await deleteVentaPagoUseCase(id, pagoId);
  return {
    type: 'ventaPaymentDeleted',
    ventaActualizada: ventaActualizada ?? null,
  };
}

export async function fetchMetodosPagoTercerosWithPendingQuery(): Promise<MetodoPago[]> {
  const methods = await queryMetodosPagoTercerosRead();
  return withPendingTerceroPaymentMethod(Array.isArray(methods) ? methods : []);
}

export async function fetchCategoriaPlanesQuery(categoriaId: string): Promise<Plan[]> {
  return getCategoriaPlanesRead(categoriaId);
}

export function buildVentaPaymentRows({
  loadingPagos,
  pagosVenta,
  venta,
}: {
  loadingPagos: boolean;
  pagosVenta: PagoVenta[];
  venta: VentaDoc | null;
}): VentaPago[] {
  if (!venta || loadingPagos) return [];

  if (pagosVenta.length > 0) {
    return pagosVenta.map((p, index) => {
      let fechaInicio = p.fechaInicio;
      let fechaVencimiento = p.fechaVencimiento;

      if (!fechaInicio || !fechaVencimiento) {
        if (p.isPagoInicial) {
          fechaInicio = venta.fechaInicio ?? p.fecha;
          fechaVencimiento = venta.fechaFin ?? p.fecha;
        } else {
          const pagoAnterior = pagosVenta[index + 1];
          if (pagoAnterior?.fechaVencimiento) {
            fechaInicio = pagoAnterior.fechaVencimiento;
            const mesesCiclo = p.cicloPago ? CYCLE_MONTHS[p.cicloPago as keyof typeof CYCLE_MONTHS] : 1;
            const fechaVenc = new Date(fechaInicio);
            fechaVenc.setMonth(fechaVenc.getMonth() + mesesCiclo);
            fechaVencimiento = fechaVenc;
          } else {
            fechaInicio = p.fecha;
            fechaVencimiento = p.fecha;
          }
        }
      }

      return {
        id: p.id,
        fecha: p.fecha,
        descripcion: p.descripcion ?? (p.isPagoInicial ? 'Pago Inicial' : 'Renovacion'),
        precio: p.precio ?? p.monto,
        descuento: p.descuento ?? 0,
        total: p.monto,
        metodoPagoNombre: p.metodoPago,
        destinoReembolso: p.destinoReembolso,
        moneda: p.moneda ?? venta.moneda,
        isPagoInicial: p.isPagoInicial,
        notas: p.notas,
        cicloPago: p.cicloPago,
        metodoPagoId: p.metodoPagoId,
        fechaInicio,
        fechaVencimiento,
        estado: p.estado,
        motivoAnulacion: p.motivoAnulacion,
      } as VentaPago;
    });
  }

  return [
    {
      id: 'synthetic-initial',
      fecha: venta.createdAt || venta.fechaInicio || new Date(),
      descripcion: 'Pago Inicial',
      precio: venta.precio ?? 0,
      descuento: venta.descuento ?? 0,
      total: venta.precioFinal ?? 0,
      metodoPagoId: venta.metodoPagoId ?? null,
      metodoPagoNombre: venta.metodoPagoNombre,
      moneda: venta.moneda,
      isPagoInicial: true,
      estado: 'registrado' as const,
    },
  ];
}
