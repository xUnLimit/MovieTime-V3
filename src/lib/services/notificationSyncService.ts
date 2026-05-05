/**
 * Notification Synchronization Service
 *
 * Purpose: Keep notifications collection in sync with ventas and servicios expirations
 *
 * Optimization:
 * - One query per entity (not two): Uses single query with fechaFin/fechaVencimiento <= (today + 7 days)
 * - This single query includes both próximas AND vencidas (because vencidas are subset of próximas)
 * - No duplicate queries for vencidas (saves 50% of sync queries)
 * - Run once per day via localStorage cache
 *
 * IMPORTANT: Requires fechaInicio, fechaFin, cicloPago to be populated in VentaDoc
 * Run migration first: npm run migrate:venta-fechas
 */

import { addDays, differenceInDays, startOfDay } from 'date-fns';
import { createNotificacion, queryNotificaciones, removeNotificacion, updateNotificacion } from '@/lib/supabase/notifications-repository';
import { getMetodoPagoById, queryMetodosPago } from '@/lib/supabase/catalogos-repository';
import { getServicioById, queryServicios } from '@/lib/supabase/servicios-repository';
import { getVentaById, queryVentas } from '@/lib/supabase/ventas-repository';
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
 * and both pass the localStorage check before either writes marcarSincronizado().
 */
let sincronizandoEnCurso = false;

/**
 * Check if we've already synchronized today
 * Uses localStorage to store last sync date (local time)
 */
function debesSincronizar(): boolean {
  if (typeof window === 'undefined') return false;

  const lastSync = localStorage.getItem('lastNotificationSync');
  const today = new Date().toDateString();

  return lastSync !== today;
}

/**
 * Mark today as synced
 */
function marcarSincronizado(): void {
  if (typeof window === 'undefined') return;

  const today = new Date().toDateString();
  localStorage.setItem('lastNotificationSync', today);
}

/**
 * Calculate priority based on days remaining
 * Matches notification thresholds
 */
function calcularPrioridad(diasRestantes: number): 'baja' | 'media' | 'alta' | 'critica' {
  if (diasRestantes <= 0) return 'critica'; // Expired or due today
  if (diasRestantes <= 3) return 'alta';
  if (diasRestantes <= 7) return 'media';
  return 'baja';
}

/**
 * Generate notification title based on entity and days remaining
 */
function generarTitulo(diasRestantes: number, entidad: 'venta' | 'servicio'): string {
  if (diasRestantes < 0) {
    const diasVencidos = Math.abs(diasRestantes);
    return entidad === 'venta'
      ? `Venta vencida hace ${diasVencidos} día${diasVencidos > 1 ? 's' : ''}`
      : `Servicio vencido hace ${diasVencidos} día${diasVencidos > 1 ? 's' : ''}`;
  }

  if (diasRestantes === 0) {
    return entidad === 'venta' ? 'Venta vence hoy ⚠️' : 'Servicio vence hoy ⚠️';
  }

  return entidad === 'venta'
    ? `Venta vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`
    : `Servicio vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`;
}

function obtenerTerminacionTarjeta(metodoPago?: Pick<MetodoPago, 'numeroTarjeta'> | null): string {
  return metodoPago?.numeroTarjeta?.replace(/\D/g, '').slice(-4) || '';
}

/**
 * Check if priority increased (notification should be unmarked as read)
 */
function prioridadSubio(anterior: string, nueva: string): boolean {
  const prioridades = ['baja', 'media', 'alta', 'critica'];
  return prioridades.indexOf(nueva) > prioridades.indexOf(anterior);
}

/**
 * Process a single venta and create/update notification
 *
 * @param venta - VentaDoc with denormalized fechaFin
 * @param notifExistente - Pre-fetched existing notification if any
 */
async function procesarNotificacionVenta(
  venta: VentaDoc,
  notifExistente?: NotificacionVenta & { id: string },
  forzarActualizacion = false,
  metodosPagoById?: Map<string, MetodoPago>
): Promise<void> {
  // Validate required denormalized field (fechaFin es el único crítico para calcular diasRestantes)
  if (!venta.fechaFin) {
    console.warn(
      `[NotificationSync] Venta ${venta.id} missing fechaFin. Skipping.`
    );
    return;
  }

  const diasRestantes = differenceInDays(startOfDay(new Date(venta.fechaFin)), startOfDay(new Date()));
  const nuevaPrioridad = calcularPrioridad(diasRestantes);
  const metodoPago = venta.metodoPagoId ? metodosPagoById?.get(venta.metodoPagoId) : undefined;

  // Prepare denormalized data
  const datosNotificacion: Omit<NotificacionVenta, 'id' | 'createdAt'> = {
    entidad: 'venta',
    tipo: 'sistema',
    prioridad: nuevaPrioridad,
    titulo: generarTitulo(diasRestantes, 'venta'),
    diasRestantes,
    leida: false,
    resaltada: false,

    // References
    ventaId: venta.id,
    clienteId: venta.clienteId || '',
    servicioId: venta.servicioId,
    categoriaId: venta.categoriaId,

    // Denormalized from VentaDoc
    clienteNombre: venta.clienteNombre,
    clienteTelefono: venta.clienteTelefono,  // For WhatsApp notifications
    servicioNombre: venta.servicioNombre,
    servicioCorreo: venta.servicioCorreo,  // For WhatsApp messages
    servicioContrasena: venta.servicioContrasena,  // For WhatsApp messages
    categoriaNombre: venta.categoriaNombre || '',
    perfilNombre: venta.perfilNombre,
    codigo: venta.codigo,  // For WhatsApp messages
    estado: venta.estado || 'activo',

    // Denormalized from PagoVenta (denormalized en VentaDoc)
    cicloPago: venta.cicloPago,
    fechaInicio: venta.fechaInicio,
    fechaFin: venta.fechaFin,
    precioFinal: venta.precioFinal, // Final price after discount
    metodoPagoId: venta.metodoPagoId, // For renewals
    metodoPagoNombre: venta.metodoPagoNombre || metodoPago?.nombre,
    moneda: venta.moneda, // Currency

    updatedAt: new Date(),
  };

  if (notifExistente) {
    // Update existing notification
    // Update if diasRestantes changed, or if forced refresh
    if (forzarActualizacion || notifExistente.diasRestantes !== diasRestantes) {
      const aumentoPrioridad = prioridadSubio(notifExistente.prioridad, nuevaPrioridad);

      await updateNotificacion(notifExistente.id, {
        ...datosNotificacion,
        leida: aumentoPrioridad ? false : notifExistente.leida, // Mark as unread if priority increased
        resaltada: notifExistente.resaltada, // Always preserve highlighted state
      });
    }
  } else {
    // Create new notification
    await createNotificacion(datosNotificacion as Record<string, unknown>);
  }
}

/**
 * Process a single servicio and create/update notification
 *
 * @param servicio - Servicio document
 * @param notifExistente - Pre-fetched existing notification if any
 */
async function procesarNotificacionServicio(
  servicio: Servicio,
  notifExistente?: NotificacionServicio & { id: string },
  forzarActualizacion = false,
  metodosPagoById?: Map<string, MetodoPago>
): Promise<void> {
  if (!servicio.fechaVencimiento) {
    console.warn(
      `[NotificationSync] Servicio ${servicio.id} missing fechaVencimiento. Skipping.`
    );
    return;
  }

  const diasRestantes = differenceInDays(startOfDay(new Date(servicio.fechaVencimiento)), startOfDay(new Date()));
  const nuevaPrioridad = calcularPrioridad(diasRestantes);
  const metodoPago = servicio.metodoPagoId
    ? metodosPagoById?.get(servicio.metodoPagoId) ?? await getMetodoPagoById<MetodoPago>(servicio.metodoPagoId)
    : null;
  const metodoPagoTarjetaTerminacion = obtenerTerminacionTarjeta(metodoPago);
  const renovacionAutomatica = servicio.renovacionAutomatica === true;

  // Prepare denormalized data
  const datosNotificacion: Omit<NotificacionServicio, 'id' | 'createdAt'> = {
    entidad: 'servicio',
    tipo: 'sistema',
    prioridad: nuevaPrioridad,
    titulo: generarTitulo(diasRestantes, 'servicio'),
    diasRestantes,
    leida: false,
    resaltada: false,

    // References
    servicioId: servicio.id,
    categoriaId: servicio.categoriaId,

    // Denormalized from Servicio
    servicioNombre: servicio.nombre,
    categoriaNombre: servicio.categoriaNombre || '',
    tipoServicio: servicio.tipo,
    correo: servicio.correo,
    contrasena: servicio.contrasena,
    metodoPagoNombre: servicio.metodoPagoNombre || '',
    metodoPagoTarjetaTerminacion,
    moneda: servicio.moneda || 'USD',
    costoServicio: servicio.costoServicio,
    cicloPago: servicio.cicloPago || 'mensual',
    fechaVencimiento: servicio.fechaVencimiento,
    renovacionAutomatica,

    updatedAt: new Date(),
  };

  if (notifExistente) {
    // Update existing
    // Update if status or denormalized display data changed, or if forced refresh
    const debeActualizar =
      forzarActualizacion ||
      notifExistente.diasRestantes !== diasRestantes ||
      notifExistente.metodoPagoNombre !== datosNotificacion.metodoPagoNombre ||
      (notifExistente.metodoPagoTarjetaTerminacion || '') !== metodoPagoTarjetaTerminacion ||
      (notifExistente.renovacionAutomatica ?? false) !== renovacionAutomatica;

    if (debeActualizar) {
      const aumentoPrioridad = prioridadSubio(notifExistente.prioridad, nuevaPrioridad);

      await updateNotificacion(notifExistente.id, {
        ...datosNotificacion,
        leida: aumentoPrioridad ? false : notifExistente.leida,
        resaltada: notifExistente.resaltada, // Always preserve highlighted state
      });
    }
  } else {
    // Create new
    await createNotificacion(datosNotificacion as Record<string, unknown>);
  }
}

/**
 * Process a reposo service and create/update completion notification
 * Only creates notification when fechaFinReposo <= today (reposo completed)
 */
async function procesarNotificacionReposo(
  servicio: Servicio,
  notifExistente?: NotificacionReposo & { id: string },
  forzarActualizacion = false
): Promise<void> {
  if (!servicio.fechaFinReposo) return;

  const diasRestantes = differenceInDays(startOfDay(new Date(servicio.fechaFinReposo)), startOfDay(new Date()));

  // Only notify when reposo is completed or about to complete (within 7 days)
  if (diasRestantes > 7) return;

  const nuevaPrioridad = diasRestantes <= 0 ? 'critica' : diasRestantes <= 3 ? 'alta' : 'media';
  const titulo = diasRestantes <= 0
    ? `Reposo completado — ${servicio.nombre}`
    : `Reposo finaliza en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''} — ${servicio.nombre}`;

  const datosNotificacion: Omit<NotificacionReposo, 'id' | 'createdAt'> = {
    entidad: 'reposo',
    tipo: 'sistema',
    prioridad: nuevaPrioridad,
    titulo,
    diasRestantes,
    leida: false,
    resaltada: false,
    servicioId: servicio.id,
    categoriaId: servicio.categoriaId,
    servicioNombre: servicio.nombre,
    categoriaNombre: servicio.categoriaNombre || '',
    correo: servicio.correo,
    fechaInicio: servicio.fechaInicio,
    fechaFin: servicio.fechaVencimiento,
    diasReposo: servicio.diasReposo || 28,
    fechaInicioReposo: servicio.fechaInicioReposo!,
    fechaFinReposo: servicio.fechaFinReposo,
    updatedAt: new Date(),
  };

  if (notifExistente) {
    const debeActualizar =
      forzarActualizacion ||
      notifExistente.diasRestantes !== diasRestantes ||
      notifExistente.titulo !== titulo;

    if (debeActualizar) {
      const aumentoPrioridad = prioridadSubio(notifExistente.prioridad, nuevaPrioridad);
      await updateNotificacion(notifExistente.id, {
        ...datosNotificacion,
        leida: aumentoPrioridad ? false : notifExistente.leida,
        resaltada: notifExistente.resaltada,
      });
    }
  } else {
    await createNotificacion(datosNotificacion as Record<string, unknown>);
  }
}

/**
 * Remove notifications whose venta/servicio no longer exists or is no longer active
 * This handles the case where a venta/servicio was deleted outside of the notification flow
 */
async function limpiarNotificacionesHuerfanas(
  ventasActivas: VentaDoc[],
  serviciosActivos: Servicio[],
  serviciosReposo: Servicio[],
  notifExistentesVenta: (NotificacionVenta & { id: string })[],
  notifExistentesServicio: (NotificacionServicio & { id: string })[],
  notifExistentesReposo: (NotificacionReposo & { id: string })[]
): Promise<void> {
  try {
    const ventaIdsActivos = new Set(ventasActivas.map(v => v.id));
    const servicioIdsActivos = new Set(serviciosActivos.map(s => s.id));
    const reposoIdsActivos = new Set(serviciosReposo.map(s => s.id));

    const huerfanas: (Notificacion & { id: string })[] = [
      ...notifExistentesVenta.filter(n => !ventaIdsActivos.has(n.ventaId)),
      ...notifExistentesServicio.filter(n => !servicioIdsActivos.has(n.servicioId)),
      ...notifExistentesReposo.filter(n => !reposoIdsActivos.has(n.servicioId)),
    ];

    if (huerfanas.length > 0) {
      // Use parallel deletion
      await Promise.all(huerfanas.map(notif => removeNotificacion(notif.id)));
    }
  } catch (error) {
    // Cleanup is best-effort, don't fail the sync
    console.warn('[NotificationSync] Error cleaning up orphan notifications:', error);
  }
}

/**
 * Main synchronization function
 * Call this once per page load (e.g., in dashboard layout useEffect)
 * Uses localStorage cache to prevent multiple syncs per day
 *
 * Performance: ~1-2 seconds with bulk reads and parallel writes.
 */
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
      localStorage.removeItem('lastNotificationSync');
      console.warn('[NotificationSync] Partial failures detected — sync will retry on next load.');
    }

  } catch (error) {
    if (!forzarActualizacion && typeof window !== 'undefined') {
      localStorage.removeItem('lastNotificationSync');
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
  // Reset daily cache so sincronizarNotificaciones runs unconditionally
  if (typeof window !== 'undefined') {
    localStorage.removeItem('lastNotificationSync');
  }
  
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
