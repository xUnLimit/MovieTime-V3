import { CYCLE_MONTHS } from '@/lib/constants';
import {
  getCategoriaPlanesRead,
  getServicioContrasenaRead,
  getVentaDetalleRead,
  queryMetodosPagoTercerosRead,
} from '@/lib/supabase/domain-read-adapters';
import { getVentaConUltimoPagoUseCase } from '@/lib/use-cases/ventas/venta-current-payment-use-cases';
import { withPendingTerceroPaymentMethod } from '@/lib/utils/terceroMetodoPago';
import type { MetodoPago, PagoVenta, VentaDoc, VentaPago } from '@/types';
import type { Plan } from '@/types/categorias';

export interface VentaDetalleQueryData {
  servicioContrasena: string;
  venta: VentaDoc | null;
}

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
