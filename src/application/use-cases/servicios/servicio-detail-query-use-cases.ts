import { getMetodoPagoRead, getServicioRead, getVentaDetalleRead } from '@/platform/supabase/domain-read-adapters';
import { getVentaById, queryVentas } from '@/platform/supabase/ventas-repository';
import type { MetodoPagoDetalle, PerfilVentaDetalle } from '@/application/use-cases/servicios/servicio-detail-types';
import type { Servicio, VentaDoc } from '@/types';

function toPerfilVenta(venta: VentaDoc): PerfilVentaDetalle {
  return {
    ventaId: venta.id || undefined,
    renovaciones: venta.renovaciones,
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
