// ===========================
// USUARIO TYPES (Cliente & Revendedor unificados)
// ===========================

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  tipo: 'cliente' | 'revendedor';
  telefono: string;
  email?: string;
  metodoPagoId: string;
  metodoPagoNombre: string;
  moneda?: string;                  // Denormalizado de MetodoPago
  // Campos específicos por tipo (opcionales):
  serviciosActivos?: number;        // Denormalizado — count de ventas activas (se actualiza con increment())
  suscripcionesTotales?: number;    // Solo para revendedores (campo legacy)
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  // NOTA: montoSinConsumir NO se guarda en Firestore
  // Se calcula dinámicamente en el cliente usando useVentasPorUsuarios
}

// Type guards para facilitar discriminación
export function esCliente(usuario: Usuario): boolean {
  return usuario.tipo === 'cliente';
}

export function esRevendedor(usuario: Usuario): boolean {
  return usuario.tipo === 'revendedor';
}

// Form Types
export interface UsuarioFormData {
  nombre: string;
  apellido: string;
  tipo: 'cliente' | 'revendedor';
  telefono: string;
  email?: string;
  metodoPagoId: string;
}
