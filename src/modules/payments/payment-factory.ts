import { queryPagosServicio, queryPagosVenta } from '@/platform/supabase/pagos-repository';
import { createPagoServicio, createPagoVenta } from '@/platform/supabase/payments-repository';
import type { PagoServicio, PagoVenta } from '@/types';

type CicloPago = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export async function createInitialVentaPayment(
  ventaId: string,
  clienteId: string,
  clienteNombre: string,
  categoriaId: string,
  monto: number,
  metodoPago: string,
  metodoPagoId?: string,
  moneda?: string,
  cicloPago?: CicloPago,
  notas?: string,
  fechaInicio?: Date,
  fechaVencimiento?: Date
): Promise<string> {
  return createPagoVenta({
    ventaId,
    clienteId,
    clienteNombre,
    categoriaId,
    fecha: new Date(),
    monto,
    metodoPagoId,
    metodoPago,
    moneda,
    notas: notas ?? '',
    isPagoInicial: true,
    cicloPago,
    fechaInicio,
    fechaVencimiento,
  });
}

export async function createRenewalVentaPayment(
  ventaId: string,
  clienteId: string,
  clienteNombre: string,
  categoriaId: string,
  monto: number,
  metodoPago: string,
  metodoPagoId?: string,
  moneda?: string,
  cicloPago?: CicloPago,
  notas?: string,
  fechaInicio?: Date,
  fechaVencimiento?: Date,
  precio?: number,
  descuento?: number,
  planId?: string,
  planNombre?: string,
  planTipoNombre?: string
): Promise<string> {
  return createPagoVenta({
    ventaId,
    clienteId,
    clienteNombre,
    categoriaId,
    fecha: new Date(),
    monto,
    precio,
    descuento,
    metodoPagoId,
    metodoPago,
    moneda,
    notas: notas ?? '',
    isPagoInicial: false,
    cicloPago,
    fechaInicio,
    fechaVencimiento,
    planId,
    planNombre,
    planTipoNombre,
  });
}

export async function getVentaPayments(ventaId: string): Promise<PagoVenta[]> {
  return queryPagosVenta<PagoVenta>([
    { field: 'ventaId', operator: '==', value: ventaId },
  ]);
}

export async function countVentaRenewals(ventaId: string): Promise<number> {
  const payments = await getVentaPayments(ventaId);
  return payments.filter((payment) => !payment.isPagoInicial).length;
}

export async function getManyVentaPayments(ventaIds: string[]): Promise<PagoVenta[]> {
  if (ventaIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ventaIds.length; i += 10) {
    chunks.push(ventaIds.slice(i, i + 10));
  }

  const payments = await Promise.all(
    chunks.map((chunk) =>
      queryPagosVenta<PagoVenta>([
        { field: 'ventaId', operator: 'in', value: chunk },
      ])
    )
  );

  return payments.flat();
}

export async function createInitialServicioPayment(
  servicioId: string,
  categoriaId: string,
  monto: number,
  metodoPagoId: string,
  metodoPagoNombre: string,
  moneda: string,
  cicloPago: CicloPago,
  fechaInicio: Date,
  fechaVencimiento: Date,
  notas?: string,
  renovacionAutomatica?: boolean
): Promise<void> {
  await createPagoServicio({
    servicioId,
    categoriaId,
    fecha: new Date(),
    descripcion: 'Pago inicial',
    cicloPago,
    fechaInicio,
    fechaVencimiento,
    monto,
    metodoPagoId,
    metodoPagoNombre,
    moneda,
    renovacionAutomatica,
    isPagoInicial: true,
    notas: notas || '',
  });
}

export async function createRenewalServicioPayment(
  servicioId: string,
  categoriaId: string,
  monto: number,
  metodoPagoId: string,
  metodoPagoNombre: string,
  moneda: string,
  cicloPago: CicloPago,
  fechaInicio: Date,
  fechaVencimiento: Date,
  numeroRenovacion: number,
  notas?: string,
  renovacionAutomatica?: boolean
): Promise<void> {
  await createPagoServicio({
    servicioId,
    categoriaId,
    fecha: new Date(),
    descripcion: `Renovación #${numeroRenovacion}`,
    cicloPago,
    fechaInicio,
    fechaVencimiento,
    monto,
    metodoPagoId,
    metodoPagoNombre,
    moneda,
    renovacionAutomatica,
    isPagoInicial: false,
    notas: notas || '',
  });
}

export async function getServicioPayments(servicioId: string): Promise<PagoServicio[]> {
  const docs = await queryPagosServicio<PagoServicio>([
    { field: 'servicioId', operator: '==', value: servicioId },
  ]);

  return sortServicioPaymentsByNewest(docs);
}

export async function countServicioRenewals(servicioId: string): Promise<number> {
  const payments = await getServicioPayments(servicioId);
  return payments.filter((payment) => !payment.isPagoInicial && payment.descripcion !== 'Pago inicial').length;
}

export async function getManyServicioPayments(servicioIds: string[]): Promise<PagoServicio[]> {
  if (servicioIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < servicioIds.length; i += 10) {
    chunks.push(servicioIds.slice(i, i + 10));
  }

  const allPayments: PagoServicio[] = [];

  for (const chunk of chunks) {
    const docs = await queryPagosServicio<PagoServicio>([
      { field: 'servicioId', operator: 'in', value: chunk },
    ]);
    allPayments.push(...docs);
  }

  return sortServicioPaymentsByNewest(allPayments);
}

function sortServicioPaymentsByNewest(payments: PagoServicio[]): PagoServicio[] {
  return [...payments].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

export {
  createInitialVentaPayment as crearPagoInicialVenta,
  createRenewalVentaPayment as crearPagoRenovacionVenta,
  getVentaPayments as obtenerPagosDeVenta,
  countVentaRenewals as contarRenovacionesDeVenta,
  getManyVentaPayments as obtenerPagosDeVariasVentas,
  createInitialServicioPayment as crearPagoInicialServicio,
  createRenewalServicioPayment as crearPagoRenovacionServicio,
  getServicioPayments as obtenerPagosDeServicio,
  countServicioRenewals as contarRenovacionesDeServicio,
  getManyServicioPayments as obtenerPagosDeVariosServicios,
};
