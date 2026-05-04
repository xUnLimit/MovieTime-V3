import { CambioLog } from '@/types';

/**
 * Configuración de campos trackeables por entidad
 */
const TRACKEABLE_FIELDS: Record<string, Record<string, { label: string; tipo: CambioLog['tipo'] }>> = {
  servicio: {
    nombre: { label: 'Nombre', tipo: 'string' },
    activo: { label: 'Estado', tipo: 'boolean' },
    enReposo: { label: 'Reposo', tipo: 'boolean' },
    perfilesDisponibles: { label: 'Perfiles Disponibles', tipo: 'number' },
    perfilesOcupados: { label: 'Perfiles Ocupados', tipo: 'number' },
    fechaVencimiento: { label: 'Fecha Vencimiento', tipo: 'date' },
    costoServicio: { label: 'Costo', tipo: 'money' },
    categoriaNombre: { label: 'Categoría', tipo: 'string' },
    metodoPagoNombre: { label: 'Método de Pago', tipo: 'string' },
  },
  venta: {
    estado: { label: 'Estado', tipo: 'string' },
    precioFinal: { label: 'Precio Final', tipo: 'money' },
    fechaFin: { label: 'Fecha Fin', tipo: 'date' },
    perfilNombre: { label: 'Perfil', tipo: 'string' },
    cicloPago: { label: 'Ciclo de Pago', tipo: 'string' },
  },
  usuario: {
    nombre: { label: 'Nombre', tipo: 'string' },
    email: { label: 'Email', tipo: 'string' },
    telefono: { label: 'Teléfono', tipo: 'string' },
    montoSinConsumir: { label: 'Monto Sin Consumir', tipo: 'money' },
    serviciosActivos: { label: 'Servicios Activos', tipo: 'number' },
  },
  cliente: {
    nombre: { label: 'Nombre', tipo: 'string' },
    email: { label: 'Email', tipo: 'string' },
    telefono: { label: 'Teléfono', tipo: 'string' },
    montoSinConsumir: { label: 'Monto Sin Consumir', tipo: 'money' },
    serviciosActivos: { label: 'Servicios Activos', tipo: 'number' },
  },
  revendedor: {
    nombre: { label: 'Nombre', tipo: 'string' },
    email: { label: 'Email', tipo: 'string' },
    telefono: { label: 'Teléfono', tipo: 'string' },
    montoSinConsumir: { label: 'Monto Sin Consumir', tipo: 'money' },
    serviciosActivos: { label: 'Servicios Activos', tipo: 'number' },
  },
  categoria: {
    nombre: { label: 'Nombre', tipo: 'string' },
    descripcion: { label: 'Descripción', tipo: 'string' },
    tipoCategoria: { label: 'Tipo', tipo: 'string' },
  },
  metodo_pago: {
    nombre: { label: 'Nombre', tipo: 'string' },
    tipo: { label: 'Tipo', tipo: 'string' },
    activo: { label: 'Estado', tipo: 'boolean' },
  },
  gasto: {
    tipoGastoNombre: { label: 'Tipo de Gasto', tipo: 'string' },
    fecha: { label: 'Fecha', tipo: 'date' },
    monto: { label: 'Monto', tipo: 'money' },
    detalle: { label: 'Detalle', tipo: 'string' },
  },
  template: {
    nombre: { label: 'Nombre', tipo: 'string' },
    tipo: { label: 'Tipo', tipo: 'string' },
    contenido: { label: 'Contenido', tipo: 'string' },
    activo: { label: 'Estado', tipo: 'boolean' },
  },
};

/**
 * Compara dos objetos y genera un array de cambios
 */
export function detectarCambios<T extends Record<string, unknown>>(
  entidad: string,
  anterior: T,
  nuevo: T
): CambioLog[] {
  const cambios: CambioLog[] = [];
  const camposTrackeable = TRACKEABLE_FIELDS[entidad];

  if (!camposTrackeable) return cambios;

  for (const [campoKey, config] of Object.entries(camposTrackeable)) {
    const valorAnterior = anterior[campoKey];
    const valorNuevo = nuevo[campoKey];

    // Comparar valores (manejar null, undefined, objetos Date, etc.)
    if (!sonValoresIguales(valorAnterior, valorNuevo)) {
      cambios.push({
        campo: config.label,
        campoKey,
        anterior: valorAnterior,
        nuevo: valorNuevo,
        tipo: config.tipo,
      });
    }
  }

  return cambios;
}

/**
 * Compara dos valores considerando null, undefined, Date, etc.
 */
function sonValoresIguales(a: unknown, b: unknown): boolean {
  // Ambos null o undefined
  if (a == null && b == null) return true;
  // Solo uno es null/undefined
  if (a == null || b == null) return false;

  // Fechas
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Primitivos
  return a === b;
}

/**
 * Genera el texto resumido de cambios para el campo `detalles`
 */
export function generarResumenCambios(cambios: CambioLog[]): string {
  if (cambios.length === 0) return 'sin cambios';
  if (cambios.length === 1) return `1 cambio: ${cambios[0].campo}`;
  if (cambios.length <= 3) {
    return `${cambios.length} cambios: ${cambios.map(c => c.campo).join(', ')}`;
  }
  return `${cambios.length} cambios: ${cambios.slice(0, 3).map(c => c.campo).join(', ')}...`;
}
