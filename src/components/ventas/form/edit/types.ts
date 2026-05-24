export interface VentaEditData {
  id: string;
  clienteId: string;
  clienteNombre: string;
  metodoPagoId: string;
  metodoPagoNombre: string;
  moneda: string;
  categoriaId: string;
  servicioId: string;
  servicioNombre: string;
  servicioCorreo: string;
  perfilNumero?: number | null;
  perfilNombre?: string;
  cicloPago?: "mensual" | "trimestral" | "semestral" | "anual";
  fechaInicio: Date;
  fechaFin: Date;
  codigo?: string;
  estado?: "activo" | "inactivo";
  precio: number;
  descuento: number;
  precioFinal: number;
  notas?: string;
}
