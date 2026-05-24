/**
 * Notification Synchronization Service
 *
 * Purpose: Keep notifications collection in sync with ventas and servicios expirations
 *
 * Optimization:
 * - One query per entity (not two): Uses single query with fechaFin/fechaVencimiento <= (today + 7 days)
 * - This single query includes both próximas AND vencidas (because vencidas are subset of próximas)
 * - No duplicate queries for vencidas (saves 50% of sync queries)
 * - Run once per day per browser runtime
 *
 * IMPORTANT: Requires fechaInicio, fechaFin, cicloPago to be populated in VentaDoc
 * Run migration first: npm run migrate:venta-fechas
 */

import { addDays, startOfDay } from 'date-fns';
import { queryNotificaciones, removeNotificacion } from '@/lib/supabase/notifications-repository';
import { queryMetodosPago } from '@/lib/supabase/catalogos-repository';
import { getServicioById, queryServicios } from '@/lib/supabase/servicios-repository';
import { getVentaById, queryVentas } from '@/lib/supabase/ventas-repository';
import { limpiarNotificacionesHuerfanas } from '@/lib/notifications/notification-cleanup';
import {
  procesarNotificacionReposo,
} from '@/lib/notifications/reposo-notification-sync';
import {
  procesarNotificacionServicio,
} from '@/lib/notifications/servicio-notification-sync';
import {
  procesarNotificacionVenta,
} from '@/lib/notifications/venta-notification-sync';
import type {
  Notificacion,
  NotificacionVenta,
  NotificacionServicio,
  NotificacionReposo,
} from '@/types/notificaciones';
import type { VentaDoc } from '@/types/ventas';
import type { Servicio } from '@/types/servicios';
import type { MetodoPago } from '@/types/metodos-pago';

/**
 * In-memory flag to prevent concurrent sync executions.
 * Without this, layout.tsx and notificaciones/page.tsx mount simultaneously
 * and both pass the sync check before either writes marcarSincronizado().
 */
let sincronizandoEnCurso = false;
let ultimaSincronizacion: string | null = null;

/**
 * Check if we've already synchronized today
 */
function debesSincronizar(): boolean {
  if (typeof window === 'undefined') return false;

  const today = new Date().toDateString();

  return ultimaSincronizacion !== today;
}

/**
 * Mark today as synced
 */
function marcarSincronizado(): void {
  if (typeof window === 'undefined') return;

  ultimaSincronizacion = new Date().toDateString();
}

export async function sincronizarNotificaciones(forzarActualizacion = false): Promise<void> {
  // Check if already synced today (skip check when forcing)
  if (!forzarActualizacion && !debesSincronizar()) {
    return;
  }

  // Prevent concurrent executions
  if (sincronizandoEnCurso) {
    return;
  }
  sincronizandoEnCurso = true;

  try {
    // Mark as synced to prevent second caller
    if (!forzarActualizacion) {
      marcarSincronizado();
    }

    // 0️⃣ BULK FETCH: Fetch all existing notifications and items in parallel
    const fechaLimite = addDays(new Date(), 7);

    const [
      todasNotifVentas,
      todasNotifServicios,
      todasNotifReposo,
      ventasProximas,
      serviciosProximos,
      serviciosEnReposo,
      metodosPago
    ] = await Promise.all([
      queryNotificaciones([{ field: 'entidad', operator: '==', value: 'venta' }]) as Promise<(NotificacionVenta & { id: string })[]>,
      queryNotificaciones([{ field: 'entidad', operator: '==', value: 'servicio' }]) as Promise<(NotificacionServicio & { id: string })[]>,
      queryNotificaciones([{ field: 'entidad', operator: '==', value: 'reposo' }]) as Promise<(NotificacionReposo & { id: string })[]>,
      queryVentas([
        { field: 'estado', operator: '==', value: 'activo' },
        { field: 'fechaFin', operator: '<=', value: fechaLimite },
      ]) as Promise<VentaDoc[]>,
      queryServicios([
        { field: 'activo', operator: '==', value: true },
        { field: 'fechaVencimiento', operator: '<=', value: fechaLimite },
      ]) as Promise<Servicio[]>,
      queryServicios([
        { field: 'enReposo', operator: '==', value: true },
      ]) as Promise<Servicio[]>,
      queryMetodosPago() as Promise<MetodoPago[]>,
    ]);

    // Create maps for O(1) lookups
    const mapNotifVentas = new Map(todasNotifVentas.map(n => [n.ventaId, n]));
    const mapNotifServicios = new Map(todasNotifServicios.map(n => [n.servicioId, n]));
    const mapNotifReposo = new Map(todasNotifReposo.map(n => [n.servicioId, n]));
    const mapMetodosPago = new Map(metodosPago.map(m => [m.id, m]));

    let huboFallosParciales = false;

    // 1️⃣ Process Ventas (Parallel)
    const promesasVentas = ventasProximas.map(venta => 
      procesarNotificacionVenta(venta, mapNotifVentas.get(venta.id), forzarActualizacion, mapMetodosPago)
        .catch(error => {
          huboFallosParciales = true;
          console.error(`[NotificationSync] Error processing venta ${venta.id}:`, error);
        })
    );

    // 2️⃣ Process Servicios (Parallel)
    const promesasServicios = serviciosProximos.map(servicio => 
      procesarNotificacionServicio(servicio, mapNotifServicios.get(servicio.id), forzarActualizacion, mapMetodosPago)
        .catch(error => {
          huboFallosParciales = true;
          console.error(`[NotificationSync] Error processing servicio ${servicio.id}:`, error);
        })
    );

    // 3️⃣ Process Reposo (Parallel)
    const promesasReposo = serviciosEnReposo.map(servicio => 
      procesarNotificacionReposo(servicio, mapNotifReposo.get(servicio.id), forzarActualizacion)
        .catch(error => {
          huboFallosParciales = true;
          console.error(`[NotificationSync] Error processing reposo ${servicio.id}:`, error);
        })
    );

    // Run all updates in parallel
    await Promise.all([...promesasVentas, ...promesasServicios, ...promesasReposo]);

    // 4️⃣ Cleanup orphan notifications (Optimized with pre-fetched data)
    await limpiarNotificacionesHuerfanas(
      ventasProximas, 
      serviciosProximos, 
      serviciosEnReposo,
      todasNotifVentas,
      todasNotifServicios,
      todasNotifReposo
    );

    // If any individual item failed, revert the sync marker so it retries today
    if (huboFallosParciales && !forzarActualizacion && typeof window !== 'undefined') {
      ultimaSincronizacion = null;
      console.warn('[NotificationSync] Partial failures detected — sync will retry on next load.');
    }

  } catch (error) {
    if (!forzarActualizacion && typeof window !== 'undefined') {
      ultimaSincronizacion = null;
    }
    console.error('[NotificationSync] ❌ Error during synchronization:', error);
    throw error;
  } finally {
    sincronizandoEnCurso = false;
  }
}

/**
 * Force refresh notifications (bypass cache)
 * Updates all notifications with fresh data while preserving leida/resaltada state.
 * Also removes orphan notifications for deleted ventas/servicios.
 */
export async function sincronizarNotificacionesForzado(): Promise<void> {
  // Reset daily marker so sincronizarNotificaciones runs unconditionally.
  ultimaSincronizacion = null;
  
  sincronizandoEnCurso = false;

  // Run full sync with forzarActualizacion=true: updates every notification
  // with fresh data from Supabase but preserves leida and resaltada state
  await sincronizarNotificaciones(true);
}

/**
 * Surgical sync for a single Venta
 * Updates or creates notification for a specific sale, or removes it if no longer needed.
 */
export async function sincronizarUnaVenta(ventaId: string): Promise<void> {
  try {
    const [venta, notificacionesExistentes] = await Promise.all([
      getVentaById<VentaDoc>(ventaId),
      queryNotificaciones([
        { field: 'entidad', operator: '==', value: 'venta' },
        { field: 'ventaId', operator: '==', value: ventaId }
      ]) as Promise<(NotificacionVenta & { id: string })[]>
    ]);

    if (!venta || venta.estado === 'inactivo') {
      // If venta doesn't exist or is inactive, remove any existing notifications
      if (notificacionesExistentes.length > 0) {
        await Promise.all(notificacionesExistentes.map((n: NotificacionVenta & { id: string }) => removeNotificacion(n.id)));
      }
      return;
    }

    // Check if it's within notification range (vencida or next 7 days)
    const fechaLimite = addDays(new Date(), 7);
    const esProxima = venta.fechaFin && startOfDay(new Date(venta.fechaFin)) <= startOfDay(fechaLimite);

    if (esProxima) {
      const metodosPago = await queryMetodosPago() as MetodoPago[];
      await procesarNotificacionVenta(
        venta,
        notificacionesExistentes[0],
        true,
        new Map(metodosPago.map((metodo) => [metodo.id, metodo]))
      );
    } else if (notificacionesExistentes.length > 0) {
      // If it was próxima but now it's not (e.g., renewed far into future), remove it
      await Promise.all(notificacionesExistentes.map((n: NotificacionVenta & { id: string }) => removeNotificacion(n.id)));
    }
  } catch (error) {
    console.error(`[NotificationSync] Error in surgical sync for venta ${ventaId}:`, error);
  }
}

/**
 * Surgical sync for a single Servicio (includes Reposo check)
 * Updates or creates notification for a specific service, or removes it if no longer needed.
 */
export async function sincronizarUnServicio(servicioId: string): Promise<void> {
  try {
    const [servicio, notifServicioExistentes, notifReposoExistentes] = await Promise.all([
      getServicioById<Servicio>(servicioId),
      queryNotificaciones([
        { field: 'entidad', operator: '==', value: 'servicio' },
        { field: 'servicioId', operator: '==', value: servicioId }
      ]) as Promise<(NotificacionServicio & { id: string })[]>,
      queryNotificaciones([
        { field: 'entidad', operator: '==', value: 'reposo' },
        { field: 'servicioId', operator: '==', value: servicioId }
      ]) as Promise<(NotificacionReposo & { id: string })[]>
    ]);

    if (!servicio) {
      // If service deleted, remove all related notifications
      const allToDel: (Notificacion & { id: string })[] = [...notifServicioExistentes, ...notifReposoExistentes];
      if (allToDel.length > 0) {
        await Promise.all(allToDel.map((n: Notificacion & { id: string }) => removeNotificacion(n.id)));
      }
      return;
    }

    // 1. Check for regular service notification (expiration)
    const fechaLimite = addDays(new Date(), 7);
    const esProximo = servicio.activo && servicio.fechaVencimiento && 
                      startOfDay(new Date(servicio.fechaVencimiento)) <= startOfDay(fechaLimite);

    if (esProximo) {
      await procesarNotificacionServicio(servicio, notifServicioExistentes[0], true);
    } else if (notifServicioExistentes.length > 0) {
      await Promise.all(notifServicioExistentes.map((n: NotificacionServicio & { id: string }) => removeNotificacion(n.id)));
    }

    // 2. Check for reposo notification
    if (servicio.enReposo && servicio.fechaFinReposo) {
      await procesarNotificacionReposo(servicio, notifReposoExistentes[0], true);
    } else if (notifReposoExistentes.length > 0) {
      await Promise.all(notifReposoExistentes.map((n: NotificacionReposo & { id: string }) => removeNotificacion(n.id)));
    }
  } catch (error) {
    console.error(`[NotificationSync] Error in surgical sync for servicio ${servicioId}:`, error);
  }
}
