import { getVentaById, queryVentas } from '@/platform/supabase/ventas-repository';
import { getVentaConUltimoPagoUseCase } from '@/lib/use-cases/ventas/venta-current-payment-use-cases';
import type { VentaDoc } from '@/types';

type VentaRecord = Partial<VentaDoc> & {
  id: string;
  cortadaAt?: Date | string | null;
};

function toDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return fallback;
}

function toNullableDate(value: unknown): Date | null {
  if (value == null) return null;
  return toDate(value);
}

export function toVentaDoc(record: VentaRecord): VentaDoc {
  return {
    id: record.id,
    clienteId: record.clienteId || '',
    clienteNombre: record.clienteNombre || 'Sin cliente',
    categoriaId: record.categoriaId || '',
    categoriaNombre: record.categoriaNombre || undefined,
    servicioId: record.servicioId || '',
    servicioNombre: record.servicioNombre || 'Servicio',
    servicioCorreo: record.servicioCorreo || undefined,
    servicioContrasena: record.servicioContrasena || undefined,
    clienteTelefono: record.clienteTelefono || undefined,
    estado: record.estado ?? 'activo',
    cortadaAt: toNullableDate(record.cortadaAt),
    motivoCorte: record.motivoCorte ?? null,
    perfilNumero: record.perfilNumero ?? null,
    perfilNombre: record.perfilNombre || undefined,
    codigo: record.codigo || undefined,
    notas: record.notas || undefined,
    createdAt: toDate(record.createdAt),
    updatedAt: toDate(record.updatedAt),
    fechaInicio: toDate(record.fechaInicio),
    fechaFin: toDate(record.fechaFin),
    cicloPago: record.cicloPago || 'mensual',
  };
}

export async function getVentaDetalle(id: string): Promise<VentaDoc | null> {
  const record = await getVentaById<VentaRecord>(id);
  return record ? toVentaDoc(record) : null;
}

export async function getVentaConPagoActual(id: string): Promise<VentaDoc | null> {
  const venta = await getVentaDetalle(id);
  return venta ? getVentaConUltimoPagoUseCase(venta) : null;
}

export async function listVentasByServicio(servicioId: string): Promise<VentaDoc[]> {
  const records = await queryVentas<VentaRecord>([
    { field: 'servicioId', operator: '==', value: servicioId },
  ]);
  return records.map(toVentaDoc);
}
