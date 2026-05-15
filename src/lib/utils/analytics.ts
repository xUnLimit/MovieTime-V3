/**
 * Analytics hooks.
 *
 * Analytics provider is disabled in the Supabase runtime. These functions stay
 * as no-op wrappers so feature code does not need analytics conditionals.
 */

export function trackVentaCreada(_data: {
  monto: number;
  servicio: string;
  ciclo: string;
  tipoTercero: 'cliente' | 'revendedor';
}) {
  void _data;
}

export function trackTerceroCreado(_tipo: 'cliente' | 'revendedor') {
  void _tipo;
}

export function trackServicioCreado(_data: {
  tipo: string;
  perfiles: number;
}) {
  void _data;
}

export function trackBusqueda(_modulo: string, _termino: string) {
  void _modulo;
  void _termino;
}

export function trackEliminacion(_entidad: string) {
  void _entidad;
}

export function trackError(_errorType: string, _errorMessage: string) {
  void _errorType;
  void _errorMessage;
}
