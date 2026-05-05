// ===========================
// COMMON TYPES
// ===========================

// Activity Log Types
export type AccionLog = 'creacion' | 'actualizacion' | 'eliminacion' | 'renovacion';
export type EntidadLog = 'cliente' | 'revendedor' | 'servicio' | 'usuario' | 'categoria' | 'metodo_pago' | 'gasto' | 'venta' | 'template';

export interface CambioLog {
  campo: string;        // Nombre del campo en español (ej: "Precio", "Estado")
  campoKey: string;     // Key técnico del campo (ej: "precio", "estado")
  anterior: unknown;    // Valor anterior
  nuevo: unknown;       // Valor nuevo
  tipo?: 'string' | 'number' | 'boolean' | 'date' | 'money' | 'object';  // Para formateo
}

export interface ActivityLog {
  id: string;
  usuarioId: string;
  usuarioEmail: string;
  accion: AccionLog;
  entidad: EntidadLog;
  entidadId: string;
  entidadNombre: string;
  detalles: string;     // Texto resumido (backward compatible)
  cambios?: CambioLog[]; // Solo presente en actualizaciones
  timestamp: Date;
}

// Configuration Types
export interface TasasCambio {
  USD_PAB: number;
  USD_EUR: number;
  USD_NGN: number;
  ultimaActualizacion: Date;
}

export interface ConfiguracionNotificaciones {
  diasAntes: number[];
  horaEnvio: number;
}

export interface ConfiguracionWhatsApp {
  prefijoTelefono: string;
}

export interface Configuracion {
  id: 'global';
  tasasCambio: TasasCambio;
  notificaciones: ConfiguracionNotificaciones;
  whatsapp: ConfiguracionWhatsApp;
  updatedAt: Date;
}

// Template Mensaje Types
export type TipoTemplate = 'notificacion_regular' | 'dia_pago' | 'renovacion' | 'suscripcion' | 'cancelacion';

export interface TemplateMensaje {
  id: string;
  nombre: string;
  tipo: TipoTemplate;
  contenido: string;
  placeholders: string[];
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}
