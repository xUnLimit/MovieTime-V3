/**
 * Notification Types with Discriminated Union
 *
 * Architecture:
 * - NotificacionVenta: For venta (sale) expiration notifications
 * - NotificacionServicio: For servicio (streaming service) expiration notifications
 * - Discriminator field `entidad` enables type-safe filtering and type guards
 *
 * Notification rows carry event snapshots so tables can render without extra
 * client-side lookups. Live data remains in the normalized Supabase tables.
 */

/**
 * Base interface with common fields for all notifications
 */
export interface NotificacionBase {
  id: string;
  tipo: 'sistema'; // For future extensibility (could add 'user' type)
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  titulo: string; // Generated: "Venta vence en 15 días" or "Servicio Netflix vence en 2 días"
  leida: boolean; // Read status
  resaltada: boolean; // Highlighted/starred for priority actions
  diasRestantes: number; // Can be negative if expired
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Notification for venta (sale) expiration
 *
 * Denormalized fields from VentaDoc + PagoVenta:
 * - Avoids joins when displaying VentasProximasTableV2
 * - Updated daily by notificationSyncService
 * - All fields needed for table display are included
 */
export interface NotificacionVenta extends NotificacionBase {
  entidad: 'venta'; // Discriminator: helps TypeScript narrow union types

  // References (for identification and filtering)
  ventaId: string;
  clienteId: string;
  servicioId: string;
  categoriaId?: string; // For renewal payment tracking

  // Denormalized from VentaDoc
  clienteNombre: string; // For display in table
  clienteTelefono?: string; // Client phone number (for WhatsApp notifications)
  servicioNombre: string; // Name of streaming service (Netflix, Disney+, etc.)
  servicioCorreo?: string; // Service email (for WhatsApp messages)
  servicioContrasena?: string; // Service password (for WhatsApp messages)
  categoriaNombre: string; // Category name
  perfilNombre?: string; // Profile name (optional, for shared accounts)
  codigo?: string; // PIN code (for WhatsApp messages)
  notas?: string; // Live sale note used as renewal payment default
  estado: 'activo' | 'inactivo';

  // Denormalized from PagoVenta (most recent)
  cicloPago?: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  fechaInicio?: Date; // Start of current payment period
  fechaFin: Date; // Expiration date (required for calculations)
  precioFinal?: number; // Final price after discount
  metodoPagoId?: string; // Payment method ID (for renewals)
  metodoPagoNombre?: string; // Payment method label snapshot
  moneda?: string; // Currency (USD, TRY, ARS, etc.)
}

/**
 * Notification for servicio (streaming service) expiration
 *
 * Denormalized fields from Servicio document:
 * - Avoids joins when displaying ServiciosProximosTableV2
 * - Updated daily by notificationSyncService
 * - All fields needed for table display are included
 */
export interface NotificacionServicio extends NotificacionBase {
  entidad: 'servicio'; // Discriminator: helps TypeScript narrow union types

  // References
  servicioId: string;
  categoriaId: string;

  // Denormalized from Servicio
  servicioNombre: string; // Name of the streaming service
  categoriaNombre: string; // Category name
  tipoServicio: string; // Service type: tipoPlanConfig.id
  correo: string; // Email del servicio
  contrasena: string; // Contraseña del servicio
  metodoPagoNombre: string; // Payment method name
  metodoPagoAlias?: string; // Payment method alias
  metodoPagoTarjetaTerminacion?: string; // Last 4 digits of the service payment card
  moneda: string; // Currency (USD, TRY, ARS, etc.)
  costoServicio: number; // Service cost
  cicloPago: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  fechaVencimiento: Date; // Expiration date
  renovacionAutomatica: boolean; // Informational flag for auto-renewable accounts
}

/**
 * Notification for reposo completion
 *
 * Generated when fechaFinReposo <= today
 * Stays as "Completado" until manual activation from /reposo
 */
export interface NotificacionReposo extends NotificacionBase {
  entidad: 'reposo';

  // References
  servicioId: string;
  categoriaId: string;

  // Denormalized from Servicio
  servicioNombre: string;
  categoriaNombre: string;
  correo: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  diasReposo: number;
  fechaInicioReposo: Date;
  fechaFinReposo: Date;
}

/**
 * Union type: Notifications can be venta, servicio, or reposo
 * Use type guards to narrow
 */
export type Notificacion = NotificacionVenta | NotificacionServicio | NotificacionReposo;

export function esNotificacionVenta(n: Notificacion): n is NotificacionVenta {
  return n.entidad === 'venta';
}

export function esNotificacionServicio(n: Notificacion): n is NotificacionServicio {
  return n.entidad === 'servicio';
}

export function esNotificacionReposo(n: Notificacion): n is NotificacionReposo {
  return n.entidad === 'reposo';
}

