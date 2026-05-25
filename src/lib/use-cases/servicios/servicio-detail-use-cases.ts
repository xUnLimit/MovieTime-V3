import { getMetodoPagoRead, getServicioRead } from '@/lib/supabase/domain-read-adapters';
import { fetchVentasByFiltersUseCase } from '@/lib/use-cases/ventas/ventas-query-use-cases';
import type { MetodoPago, Servicio, VentaDoc } from '@/types';

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
  const ventasBase = await fetchVentasByFiltersUseCase<VentaDoc>([
    { field: 'servicioId', operator: '==', value: id },
  ]);

  return ventasBase
    .filter((venta) => (venta.estado ?? 'activo') !== 'inactivo')
    .map(toPerfilVenta);
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
