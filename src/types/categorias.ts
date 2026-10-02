// ===========================
// CATEGORIA TYPES
// ===========================

/**
 * Tipo de plan personalizado dentro de una categoría.
 * El usuario define sus propios tipos (ej: "Pantalla Completa", "Por Perfil").
 */
export interface TipoPlanConfig {
  id: string;
  nombre: string;
}

export interface Plan {
  id: string;
  nombre: string;
  precio: number;
  cicloPago: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  /**
   * ID del tipo de plan al que pertenece este plan.
   * Debe existir en Categoria.tiposPlanes.
   */
  tipoPlan: string;
}

export interface Categoria {
  codeProvider?: string | null;
  id: string;
  nombre: string;
  tipo: 'cliente' | 'revendedor';
  tipoCategoria?: 'plataforma_streaming' | 'otros';
  /**
   * Tipos de plan personalizados de esta categoría.
   * Define las etiquetas que aparecen al crear servicios y planes.
   */
  tiposPlanes?: TipoPlanConfig[];
  planes?: Plan[];
  notas?: string;
  activo: boolean;

  // Campos derivados desde vistas/consultas Supabase.
  totalServicios: number;           // Total de servicios en esta categoría
  serviciosActivos: number;         // Servicios con activo=true
  perfilesDisponiblesTotal: number; // Suma de (perfilesDisponibles - perfilesOcupados) de servicios activos
  ventasTotales: number;            // Total de ventas (suscripciones) asociadas a servicios de esta categoría
  ingresosTotales: number;          // Suma total de ingresos de ventas de esta categoría
  gastosTotal: number;              // Suma total de gastos (pagosServicio) de esta categoría

  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}
