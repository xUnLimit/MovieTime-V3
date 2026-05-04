/**
 * Analytics Utilities para MovieTime
 *
 * Wrapper functions para Firebase Analytics con type-safety
 */

import { logEvent } from 'firebase/analytics';
import { analytics } from '@/lib/firebase/config';

/**
 * Trackea cuando se crea una venta
 */
export function trackVentaCreada(data: {
  monto: number;
  servicio: string;
  ciclo: string;
  tipoUsuario: 'cliente' | 'revendedor';
}) {
  if (!analytics) return;
  logEvent(analytics, 'venta_creada', {
    value: data.monto,
    currency: 'USD',
    servicio: data.servicio,
    ciclo_pago: data.ciclo,
    tipo_usuario: data.tipoUsuario,
  });
}

/**
 * Trackea cuando se crea un usuario
 */
export function trackUsuarioCreado(tipo: 'cliente' | 'revendedor') {
  if (!analytics) return;
  logEvent(analytics, 'usuario_creado', {
    tipo_usuario: tipo,
  });
}

/**
 * Trackea cuando se crea un servicio
 */
export function trackServicioCreado(data: {
  tipo: string;
  perfiles: number;
}) {
  if (!analytics) return;
  logEvent(analytics, 'servicio_creado', {
    tipo_servicio: data.tipo,
    cantidad_perfiles: data.perfiles,
  });
}

/**
 * Trackea búsquedas
 */
export function trackBusqueda(modulo: string, termino: string) {
  if (!analytics) return;
  logEvent(analytics, 'search', {
    search_term: termino,
    modulo: modulo,
  });
}

/**
 * Trackea cuando un usuario elimina algo
 */
export function trackEliminacion(entidad: string) {
  if (!analytics) return;
  logEvent(analytics, 'item_deleted', {
    tipo_entidad: entidad,
  });
}

/**
 * Trackea errores en la app
 */
export function trackError(errorType: string, errorMessage: string) {
  if (!analytics) return;
  logEvent(analytics, 'app_error', {
    error_type: errorType,
    error_message: errorMessage,
  });
}
