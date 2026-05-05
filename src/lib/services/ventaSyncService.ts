/**
 * Servicio centralizado para manejar la relaciÃƒÂ³n entre Ventas y PagosVenta
 *
 * ARQUITECTURA: Single Source of Truth
 * - PagoVenta (mÃƒÂ¡s reciente) = fuente de verdad para datos actuales
 * - VentaDoc = solo metadatos y referencias (no duplica datos de pago)
 */

import { queryPagosVenta } from '@/lib/supabase/ventas-repository';
import { VentaDoc, PagoVenta } from '@/types';

/**
 * Tipo extendido que combina VentaDoc con datos del ÃƒÂºltimo pago (mÃƒÂ¡s reciente)
 */
export interface VentaConUltimoPago extends VentaDoc {
  // Datos del ÃƒÂºltimo pago (vienen del pago mÃƒÂ¡s reciente, NO de VentaDoc)
  precio: number;
  descuento: number;
  precioFinal: number;
  metodoPagoId?: string;
  metodoPagoNombre: string;
  moneda: string;
  renovaciones: number;
  // Note: cicloPago, fechaInicio, fechaFin are required in VentaDoc parent
}

/**
 * Obtiene una venta con los datos de su ÃƒÂºltimo pago (mÃƒÂ¡s reciente)
 *
 * @param venta - Documento de venta base
 * @param pagos - Array de pagos de la venta (opcional, si no se provee se consulta)
 * @returns Venta con datos del ÃƒÂºltimo pago
 */
export async function getVentaConUltimoPago(
  venta: VentaDoc,
  pagos?: PagoVenta[]
): Promise<VentaConUltimoPago> {
  // Si no se proveen los pagos, consultarlos
  let pagosList = pagos;
  if (!pagosList) {
    pagosList = await queryPagosVenta<PagoVenta>([
      { field: 'ventaId', operator: '==', value: venta.id }
    ]);
  }

  // Ordenar por fechaVencimiento descendente para encontrar el pago vigente (mÃƒÂ¡s reciente)
  const sorted = pagosList.sort((a, b) => {
    // Manejar casos donde fechaVencimiento puede ser undefined/null
    const dateA = a.fechaVencimiento
      ? (a.fechaVencimiento instanceof Date ? a.fechaVencimiento : new Date(a.fechaVencimiento))
      : new Date(0); // Fecha muy antigua si no hay fechaVencimiento
    const dateB = b.fechaVencimiento
      ? (b.fechaVencimiento instanceof Date ? b.fechaVencimiento : new Date(b.fechaVencimiento))
      : new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  const pagoMasReciente = sorted[0];

  const renovaciones = pagosList.filter(p => p.isPagoInicial === false).length;

  // Si no hay pagos, retornar valores por defecto
  if (!pagoMasReciente) {
    return {
      ...venta,
      precio: 0,
      descuento: 0,
      precioFinal: 0,
      metodoPagoId: undefined,
      metodoPagoNombre: '',
      moneda: 'USD',
      renovaciones: 0,
      // Denormalized fields from venta (required)
      cicloPago: venta.cicloPago || 'mensual',
      fechaInicio: venta.fechaInicio || new Date(),
      fechaFin: venta.fechaFin || new Date(),
    };
  }

  // Combinar venta con datos del pago mÃƒÂ¡s reciente
  return {
    ...venta,
    precio: pagoMasReciente.precio ?? pagoMasReciente.monto,
    descuento: pagoMasReciente.descuento ?? 0,
    precioFinal: pagoMasReciente.monto,
    metodoPagoId: pagoMasReciente.metodoPagoId,
    metodoPagoNombre: pagoMasReciente.metodoPago,
    moneda: pagoMasReciente.moneda ?? 'USD',
    renovaciones,
    // Denormalized fields from payment (required)
    cicloPago: pagoMasReciente.cicloPago || 'mensual',
    fechaInicio: pagoMasReciente.fechaInicio ?? new Date(),
    fechaFin: pagoMasReciente.fechaVencimiento ?? new Date(),
  };
}

/**
 * Obtiene mÃƒÂºltiples ventas con los datos de su ÃƒÂºltimo pago
 * Optimizado para cargar pagos en batch
 *
 * @param ventas - Array de ventas
 * @returns Array de ventas con datos del ÃƒÂºltimo pago
 */
export async function getVentasConUltimoPago(
  ventas: VentaDoc[]
): Promise<VentaConUltimoPago[]> {
  if (ventas.length === 0) return [];

  // Cargar todos los pagos en batch
  const ventaIds = ventas.map(v => v.id);

  // Supabase .in() max 10 values, chunk si es necesario
  const chunks: string[][] = [];
  for (let i = 0; i < ventaIds.length; i += 10) {
    chunks.push(ventaIds.slice(i, i + 10));
  }

  const allPagos = await Promise.all(
    chunks.map(chunk =>
      queryPagosVenta<PagoVenta>([
        { field: 'ventaId', operator: 'in', value: chunk },
      ])
    )
  );

  const pagosFlat = allPagos.flat();

  // Agrupar pagos por ventaId
  const pagosPorVenta = new Map<string, PagoVenta[]>();
  pagosFlat.forEach(pago => {
    const existing = pagosPorVenta.get(pago.ventaId) ?? [];
    pagosPorVenta.set(pago.ventaId, [...existing, pago]);
  });

  // Combinar cada venta con su pago mÃƒÂ¡s reciente
  return ventas.map(venta => {
    const pagosVenta = pagosPorVenta.get(venta.id) ?? [];
    const renovaciones = pagosVenta.filter(p => p.isPagoInicial === false).length;

    // Ordenar por fechaVencimiento descendente para encontrar el pago vigente (mÃƒÂ¡s reciente)
    const sorted = pagosVenta.sort((a, b) => {
      const dateA = a.fechaVencimiento
        ? (a.fechaVencimiento instanceof Date ? a.fechaVencimiento : new Date(a.fechaVencimiento))
        : new Date(0);
      const dateB = b.fechaVencimiento
        ? (b.fechaVencimiento instanceof Date ? b.fechaVencimiento : new Date(b.fechaVencimiento))
        : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    const pagoMasReciente = sorted[0];

    // Si no hay pagos, retornar valores por defecto
    if (!pagoMasReciente) {
      return {
        ...venta,
        precio: 0,
        descuento: 0,
        precioFinal: 0,
        metodoPagoId: undefined,
        metodoPagoNombre: '',
        moneda: 'USD',
        renovaciones: 0,
        cicloPago: venta.cicloPago || 'mensual',
        fechaInicio: venta.fechaInicio || new Date(),
        fechaFin: venta.fechaFin || new Date(),
      };
    }

    return {
      ...venta,
      precio: pagoMasReciente.precio ?? pagoMasReciente.monto,
      descuento: pagoMasReciente.descuento ?? 0,
      precioFinal: pagoMasReciente.monto,
      metodoPagoId: pagoMasReciente.metodoPagoId,
      metodoPagoNombre: pagoMasReciente.metodoPago,
      moneda: pagoMasReciente.moneda ?? 'USD',
      renovaciones,
      cicloPago: pagoMasReciente.cicloPago || 'mensual',
      fechaInicio: pagoMasReciente.fechaInicio ?? new Date(),
      fechaFin: pagoMasReciente.fechaVencimiento ?? new Date(),
    };
  });
}
