// ===========================
// GASTOS TYPES
// ===========================

export interface TipoGasto {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Gasto {
  id: string;
  tipoGastoId: string;
  tipoGastoNombre: string;
  fecha: Date;
  monto: number;
  detalle?: string;
  createdAt: Date;
  updatedAt: Date;
}
