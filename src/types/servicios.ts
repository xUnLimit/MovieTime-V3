// ===========================
// SERVICIO TYPES
// ===========================

export interface Servicio {
  id: string;
  categoriaId: string;
  categoriaNombre: string;
  nombre: string;
  /**
   * ID del tipo de plan configurado en Categoria.tiposPlanes.
   */
  tipo: string;
  tipoNombre?: string; // Denormalizado para display
  correo: string;
  contrasena: string;
  perfilesDisponibles: number;
  perfilesOcupados: number;
  costoServicio: number;
  gastosTotal: number; // Suma acumulada de todos los pagos del servicio
  metodoPagoId?: string;
  metodoPagoNombre?: string;  // Denormalizado de MetodoPago
  moneda?: string;            // Denormalizado de MetodoPago
  cicloPago?: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  fechaInicio?: Date;
  fechaVencimiento?: Date;
  notas?: string;
  activo: boolean;
  cortadoAt?: Date | null;
  cortadoBy?: string | null;
  motivoCorte?: string | null;
  archivadoAt?: Date | null;
  archivadoBy?: string | null;
  motivoArchivado?: string | null;
  // Reposo (servicio temporalmente pausado)
  enReposo?: boolean;
  diasReposo?: number;          // 28-31 days
  fechaInicioReposo?: Date;
  fechaFinReposo?: Date;
  renovacionAutomatica: boolean;
  fechaRenovacion?: Date;
  renovaciones?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/** Registro de un pago/renovación del servicio para el historial */
export interface PagoServicio {
  id: string;
  servicioId: string;
  categoriaId: string;  // Denormalizado de Servicio para queries eficientes
  metodoPagoId?: string;
  metodoPagoNombre?: string;  // Denormalizado de MetodoPago
  moneda?: string;
  isPagoInicial?: boolean;
  /** Fecha en que se registró el pago */
  fecha: Date;
  /** "Pago inicial" o "Renovación #1", "Renovación #2", etc. */
  descripcion: string;
  /** Ciclo de facturación de este pago (mensual, trimestral, semestral, anual) */
  cicloPago?: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  fechaInicio: Date;
  fechaVencimiento: Date;
  monto: number;
  notas?: string; // Notas adicionales del pago
  createdAt: Date;
  updatedAt: Date;
}

// Form Types
export interface ServicioFormData {
  categoriaId: string;
  nombre: string;
  tipo: string;
  correo: string;
  contrasena: string;
  perfilesDisponibles: number;
  costoPorPerfil: number;
  renovacionAutomatica: boolean;
  fechaRenovacion?: Date;
}
