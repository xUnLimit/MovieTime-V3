import type { Categoria, MetodoPago, PagoServicio, Servicio } from '@/types';

export interface PerfilVenta {
  renovaciones?: number;
  ventaId?: string;
  clienteId?: string;
  clienteNombre?: string;
  clienteTelefono?: string;
  createdAt?: Date;
  precioFinal?: number;
  descuento?: number;
  fechaInicio?: Date;
  fechaFin?: Date;
  notas?: string;
  servicioNombre?: string;
  servicioCorreo?: string;
  moneda?: string;
  perfilNombre?: string;
  codigo?: string;
  cicloPago?: string;
}

export interface PagoFormData {
  periodoRenovacion: string;
  metodoPagoId: string;
  costo: number;
  descuento?: number;
  fechaInicio: Date;
  fechaVencimiento: Date;
  notas?: string;
  metodoPagoNombre?: string;
  moneda?: string;
  renovacionAutomatica?: boolean;
}

export type CategoriaDetalle = Pick<Categoria, 'id' | 'nombre'> & Partial<Categoria>;
export type MetodoPagoDetalle = Pick<MetodoPago, 'id' | 'nombre' | 'moneda'> & Partial<MetodoPago>;
export type PerfilEstado = 'ocupado' | 'disponible' | 'inactivo';

export interface PerfilDetalle {
  numero: number;
  nombre: string;
  estado: PerfilEstado;
  clienteNombre?: string;
  venta?: PerfilVenta;
}

export type PagoAction = (pago: PagoServicio) => void | Promise<void>;
export type ServicioPagoConfirm = (data: PagoFormData) => void | Promise<void>;
export type ServicioDetalle = Servicio;
