import { create, queryDocuments, COLLECTIONS } from '@/lib/firebase/firestore';
import { PagoServicio } from '@/types';

/**
 * Servicio para gestionar pagos de servicios (PagoServicio collection)
 * Single Source of Truth: Todos los datos de pago viven aquí
 */

/**
 * Crear el pago inicial cuando se crea un servicio
 */
export async function crearPagoInicial(
  servicioId: string,
  categoriaId: string,
  monto: number,
  metodoPagoId: string,
  metodoPagoNombre: string,
  moneda: string,
  cicloPago: 'mensual' | 'trimestral' | 'semestral' | 'anual',
  fechaInicio: Date,
  fechaVencimiento: Date,
  notas?: string
): Promise<void> {
  await create(COLLECTIONS.PAGOS_SERVICIO, {
    servicioId,
    categoriaId,
    fecha: new Date(), // Fecha de registro del pago
    descripcion: 'Pago inicial',
    cicloPago,
    fechaInicio,
    fechaVencimiento,
    monto,
    metodoPagoId,
    metodoPagoNombre, // Denormalizado
    moneda,           // Denormalizado
    isPagoInicial: true,
    notas: notas || '',
  });
}

/**
 * Crear un pago de renovación
 */
export async function crearPagoRenovacion(
  servicioId: string,
  categoriaId: string,
  monto: number,
  metodoPagoId: string,
  metodoPagoNombre: string,
  moneda: string,
  cicloPago: 'mensual' | 'trimestral' | 'semestral' | 'anual',
  fechaInicio: Date,
  fechaVencimiento: Date,
  numeroRenovacion: number,
  notas?: string
): Promise<void> {
  await create(COLLECTIONS.PAGOS_SERVICIO, {
    servicioId,
    categoriaId,
    fecha: new Date(), // Fecha de registro del pago
    descripcion: `Renovación #${numeroRenovacion}`,
    cicloPago,
    fechaInicio,
    fechaVencimiento,
    monto,
    metodoPagoId,
    metodoPagoNombre, // Denormalizado
    moneda,           // Denormalizado
    isPagoInicial: false,
    notas: notas || '',
  });
}

/**
 * Obtener todos los pagos de un servicio específico
 */
export async function obtenerPagosDeServicio(servicioId: string): Promise<PagoServicio[]> {
  const docs = await queryDocuments<PagoServicio>(COLLECTIONS.PAGOS_SERVICIO, [
    { field: 'servicioId', operator: '==', value: servicioId },
  ]);

  // Ordenar por fecha descendente (más reciente primero)
  return docs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

/**
 * Contar renovaciones de un servicio (excluyendo pago inicial)
 */
export async function contarRenovacionesDeServicio(servicioId: string): Promise<number> {
  const pagos = await obtenerPagosDeServicio(servicioId);
  return pagos.filter(p => !p.isPagoInicial && p.descripcion !== 'Pago inicial').length;
}

/**
 * Obtener pagos de varios servicios (batch query con chunking automático)
 * Firestore 'in' operator tiene límite de 10 valores
 */
export async function obtenerPagosDeVariosServicios(servicioIds: string[]): Promise<PagoServicio[]> {
  if (servicioIds.length === 0) return [];

  const CHUNK_SIZE = 10;
  const chunks: string[][] = [];

  for (let i = 0; i < servicioIds.length; i += CHUNK_SIZE) {
    chunks.push(servicioIds.slice(i, i + CHUNK_SIZE));
  }

  const allPagos: PagoServicio[] = [];

  for (const chunk of chunks) {
    const docs = await queryDocuments<PagoServicio>(COLLECTIONS.PAGOS_SERVICIO, [
      { field: 'servicioId', operator: 'in', value: chunk },
    ]);
    allPagos.push(...docs);
  }

  // Ordenar por fecha descendente
  return allPagos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}
