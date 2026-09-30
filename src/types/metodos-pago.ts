// ===========================
// METODO PAGO TYPES
// ===========================

type TipoMetodoPago = 'banco' | 'yappy' | 'paypal' | 'binance' | 'efectivo';
type TipoCuenta = 'ahorro' | 'corriente' | 'wallet' | 'telefono' | 'email';
type AsociadoA = 'tercero' | 'servicio';

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
  asociadoA?: AsociadoA;
  // Campos para servicios
  email?: string;
  contrasena?: string;
  numeroTarjeta?: string;
  fechaExpiracion?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}
