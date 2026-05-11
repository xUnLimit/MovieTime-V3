import { createPagoVenta, queryPagosVenta } from '@/lib/supabase/pagos-repository';
import { PagoVenta } from '@/types';

/**
 * Servicio para manejar los pagos de ventas
 */

/**
 * Crea un pago inicial cuando se crea una venta
 */
export async function crearPagoInicial(
  ventaId: string,
  clienteId: string,
  clienteNombre: string,
  categoriaId: string,      // Denormalizado para queries
  monto: number,
  metodoPago: string,
  metodoPagoId?: string,    // Denormalizado
  moneda?: string,          // Denormalizado
  cicloPago?: 'mensual' | 'trimestral' | 'semestral' | 'anual',
  notas?: string,
  fechaInicio?: Date,
  fechaVencimiento?: Date
): Promise<string> {
  const pagoId = await createPagoVenta({
    ventaId,
    clienteId,
    clienteNombre,
    categoriaId,           // Denormalizado
    fecha: new Date(),
    monto,
    metodoPagoId,          // Denormalizado
    metodoPago,
    moneda,                // Denormalizado
    notas: notas ?? '',
    isPagoInicial: true,
    cicloPago,
    fechaInicio,
    fechaVencimiento,
  });

  return pagoId;
}

/**
 * Crea un pago de renovación para una venta existente
 */
export async function crearPagoRenovacion(
  ventaId: string,
  clienteId: string,
  clienteNombre: string,
  categoriaId: string,      // Denormalizado para queries
  monto: number,
  metodoPago: string,
  metodoPagoId?: string,    // Denormalizado
  moneda?: string,          // Denormalizado
  cicloPago?: 'mensual' | 'trimestral' | 'semestral' | 'anual',
  notas?: string,
  fechaInicio?: Date,
  fechaVencimiento?: Date,
  precio?: number,          // Precio original
  descuento?: number,       // Porcentaje de descuento
  planId?: string,
  planNombre?: string,
  planTipoNombre?: string
): Promise<string> {
  const pagoId = await createPagoVenta({
    ventaId,
    clienteId,
    clienteNombre,
    categoriaId,           // Denormalizado
    fecha: new Date(),
    monto,
    precio,                // Precio original antes de descuento
    descuento,             // Porcentaje de descuento
    metodoPagoId,          // Denormalizado
    metodoPago,
    moneda,                // Denormalizado
    notas: notas ?? '',
    isPagoInicial: false,
    cicloPago,
    fechaInicio,
    fechaVencimiento,
    planId,
    planNombre,
    planTipoNombre,
  });

  return pagoId;
}

/**
 * Obtiene todos los pagos de una venta específica
 */
export async function obtenerPagosDeVenta(ventaId: string): Promise<PagoVenta[]> {
  const pagos = await queryPagosVenta<PagoVenta>([
    { field: 'ventaId', operator: '==', value: ventaId }
  ]);

  return pagos;
}

/**
 * Cuenta las renovaciones de una venta (pagos que no son inicial)
 */
export async function contarRenovacionesDeVenta(ventaId: string): Promise<number> {
  const pagos = await obtenerPagosDeVenta(ventaId);
  return pagos.filter(p => !p.isPagoInicial).length;
}

/**
 * Obtiene los pagos de múltiples ventas (para dashboards/reportes)
 */
export async function obtenerPagosDeVariasVentas(ventaIds: string[]): Promise<PagoVenta[]> {
  if (ventaIds.length === 0) return [];

  // Supabase .in() acepta max 10 valores — partir en chunks
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

  return allPagos.flat();
}
