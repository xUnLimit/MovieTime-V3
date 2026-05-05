export interface VentaPago {
  id?: string;
  fecha?: Date | null;
  descripcion: string;
  precio: number;
  descuento: number;
  total: number;
  metodoPagoId?: string | null;
  metodoPagoNombre?: string;
  moneda?: string;
  isPagoInicial?: boolean;
  cicloPago?: 'mensual' | 'trimestral' | 'semestral' | 'anual' | null;
  fechaInicio?: Date | null;
  fechaVencimiento?: Date | null;
  notas?: string;
}

/**
 * Documento de pago de venta en la colección pagosVenta
 */
export interface PagoVenta {
  id: string;
  ventaId: string;                    // Referencia a la venta
  clienteId: string;                  // Denormalizado para queries
  clienteNombre: string;              // Denormalizado
  categoriaId?: string;               // Denormalizado para queries por categoría
  fecha: Date;                        // Fecha en que se realizó el pago
  monto: number;                      // Monto final (después de descuento)
  precio?: number;                    // Precio original antes de descuento
  descuento?: number;                 // Porcentaje de descuento (0-100)
  metodoPagoId?: string;              // Referencia al método de pago
  metodoPago: string;                 // Nombre del método de pago (denormalizado)
  moneda?: string;                    // Denormalizado de MetodoPago
  notas?: string;
  isPagoInicial: boolean;             // true para el primer pago
  cicloPago?: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  fechaInicio?: Date;                 // Fecha de inicio del periodo cubierto por este pago
  fechaVencimiento?: Date;            // Fecha de vencimiento del periodo cubierto por este pago
  createdAt: Date;
}

/**
 * Documento de venta en la colección ventas
 *
 * ARQUITECTURA: Single Source of Truth
 * - Este documento NO almacena datos de pago (precio, descuento, fechas, etc.)
 * - Esos datos viven en la colección `pagosVenta`
 * - Para obtener datos actuales, usar `getVentaConUltimoPago()` de ventaSyncService
 */
export interface VentaDoc {
  id: string;
  clienteId?: string;
  clienteNombre: string;
  clienteTelefono?: string;           // Denormalizado para notificaciones WhatsApp
  servicioId: string;
  servicioNombre: string;
  servicioCorreo?: string;
  servicioContrasena?: string;        // Denormalizado (opcional para mostrar en detalles)
  categoriaId: string;
  categoriaNombre?: string;           // Denormalizado
  estado?: 'activo' | 'inactivo';
  perfilNumero?: number | null;
  perfilNombre?: string;
  codigo?: string;
  notas?: string;

  fechaInicio?: Date;
  fechaFin?: Date;
  cicloPago?: 'mensual' | 'trimestral' | 'semestral' | 'anual';

  metodoPagoId?: string;
  metodoPagoNombre?: string;
  moneda?: string;
  precio?: number;
  descuento?: number;
  precioFinal?: number;
  totalVenta?: number;
  /** 
   * @deprecated DO NOT USE. Payments are now stored in the `pagosVenta` collection.
   * Use the `usePagosVenta` hook or `pagosVentaService` to fetch payments for a sale.
   */
  pagos?: VentaPago[];

  createdAt?: Date;
  updatedAt?: Date;
  itemId?: string;
  ventaId?: string;
}
