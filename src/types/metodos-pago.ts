// ===========================
// METODO PAGO TYPES
// ===========================

export type TipoMetodoPago = 'banco' | 'yappy' | 'paypal' | 'binance' | 'efectivo';
export type TipoCuenta = 'ahorro' | 'corriente' | 'wallet' | 'telefono' | 'email';
export type AsociadoA = 'usuario' | 'servicio';

export interface MetodoPago {
  id: string;
  nombre: string;
  tipo: TipoMetodoPago;
  banco?: string;
  pais: string;
  moneda: string;
  titular: string;
  tipoCuenta?: TipoCuenta;
  identificador: string;
  alias?: string;
  notas?: string;
  activo: boolean;
  asociadoA?: AsociadoA; // Opcional para retrocompatibilidad
  // Campos para servicios
  email?: string;
  contrasena?: string;
  numeroTarjeta?: string;
  fechaExpiracion?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}
