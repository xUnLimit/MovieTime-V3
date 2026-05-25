import { queryMetodosPago, getMetodoPagoById } from '@/lib/supabase/catalogos-repository';
import { queryNotifications } from '@/lib/supabase/notifications-repository';
import { getCategoriaUseCase } from '@/lib/use-cases/categorias-use-cases';
import {
  fetchServiciosByFiltersUseCase,
  getServicioUseCase,
} from '@/lib/use-cases/servicios/servicios-query-use-cases';
import { getVentaUseCase, timestampToDate } from '@/lib/use-cases/ventas/ventas-query-use-cases';
import type { QueryFilter } from '@/lib/supabase/entities';
import type { Categoria, MetodoPago, Notificacion, Servicio, VentaDoc } from '@/types';
import type { Plan } from '@/types/categorias';

export type NotificacionConId = Notificacion & { id: string };

export function queryNotificationsRead(filters: QueryFilter[] = []) {
  return queryNotifications<NotificacionConId>(filters);
}

export function queryNotificationIdsRead(filters: QueryFilter[] = []) {
  return queryNotifications<{ id: string }>(filters);
}

export function getMetodoPagoRead(id: string) {
  return getMetodoPagoById<MetodoPago>(id);
}

export function queryMetodosPagoRead(filters: QueryFilter[] = []) {
  return queryMetodosPago<MetodoPago>(filters);
}

export function queryMetodosPagoServiciosRead(options: { soloActivos?: boolean } = {}) {
  const filters: QueryFilter[] = [
    { field: 'asociadoA', operator: '==', value: 'servicio' },
  ];
  if (options.soloActivos) {
    filters.push({ field: 'activo', operator: '==', value: true });
  }
  return queryMetodosPagoRead(filters);
}

export function queryMetodosPagoTercerosRead(options: { soloActivos?: boolean } = {}) {
  const filters: QueryFilter[] = [
    { field: 'asociadoA', operator: '==', value: 'tercero' },
  ];
  if (options.soloActivos) {
    filters.push({ field: 'activo', operator: '==', value: true });
  }
  return queryMetodosPagoRead(filters);
}

export function getCategoriaRead(id: string) {
  return getCategoriaUseCase<Categoria>(id);
}

export async function getCategoriaPlanesRead(id: string): Promise<Plan[]> {
  const categoria = await getCategoriaRead(id);
  return Array.isArray(categoria?.planes) ? categoria.planes : [];
}

export function getServicioRead(id: string) {
  return getServicioUseCase<Servicio>(id);
}

export function fetchServiciosByIdsRead(ids: string[]) {
  return fetchServiciosByFiltersUseCase<Servicio>([
    { field: '__name__', operator: 'in', value: ids },
  ]);
}

export async function getServicioTipoRead(id: string): Promise<string | undefined> {
  const servicio = await getServicioRead(id);
  return servicio?.tipo;
}

export async function getServicioContrasenaRead(id: string): Promise<string> {
  const servicio = await getServicioRead(id);
  return servicio?.contrasena ?? '';
}

export async function getVentaDetalleRead(id: string): Promise<VentaDoc | null> {
  const doc = await getVentaUseCase<Record<string, unknown>>(id);
  if (!doc) return null;

  return {
    id: doc.id as string,
    clienteId: (doc.clienteId as string) || '',
    clienteNombre: (doc.clienteNombre as string) || 'Sin cliente',
    categoriaId: (doc.categoriaId as string) || '',
    categoriaNombre: (doc.categoriaNombre as string) || undefined,
    servicioId: (doc.servicioId as string) || '',
    servicioNombre: (doc.servicioNombre as string) || 'Servicio',
    servicioCorreo: (doc.servicioCorreo as string) || '',
    clienteTelefono: (doc.clienteTelefono as string) || undefined,
    perfilNumero: (doc.perfilNumero as number | null | undefined) ?? null,
    perfilNombre: (doc.perfilNombre as string) || '',
    codigo: (doc.codigo as string) || '',
    notas: (doc.notas as string) || '',
    estado: (doc.estado as VentaDoc['estado']) ?? 'activo',
    cortadaAt: doc.cortadaAt ? new Date(doc.cortadaAt as string) : null,
    motivoCorte: (doc.motivoCorte as string | null | undefined) ?? null,
    createdAt: doc.createdAt ? timestampToDate(doc.createdAt) : undefined,
    fechaInicio: (doc.fechaInicio as Date) || new Date(),
    fechaFin: (doc.fechaFin as Date) || new Date(),
    cicloPago: (doc.cicloPago as VentaDoc['cicloPago']) || 'mensual',
    planId: (doc.planId as string) || undefined,
    planNombre: (doc.planNombre as string) || undefined,
    planTipoNombre: (doc.planTipoNombre as string) || undefined,
  };
}
