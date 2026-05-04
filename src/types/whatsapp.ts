// ===========================
// WHATSAPP TYPES
// ===========================

export interface WhatsAppData {
  cliente: string;           // Nombre completo (nombre + apellido)
  nombreCliente?: string;    // Solo nombre (sin apellido)
  servicio: string;
  categoria: string;
  perfilNombre: string;
  correo: string;
  contrasena: string;
  vencimiento: string;
  monto: string;
  codigo: string;
  items: string;
  diasRetraso?: number;
}
