// ===========================
// COMMON TYPES
// ===========================

// Activity Log Types
export type AccionLog = 'creacion' | 'actualizacion' | 'corte' | 'eliminacion' | 'renovacion';
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
  cambios?: CambioLog[]; // Solo presente en actualizaciones/cortes
  metadata?: Record<string, unknown>; // Datos estructurados para auditoria robusta
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

export type ExecutivePushBlock =
  | 'clientes_por_notificar'
  | 'ventas_por_vencer'
  | 'servicios_por_pagar_hoy'
  | 'monto_a_pagar_hoy'
  | 'monto_a_fondear';

export interface ExecutivePushSettings {
  enabled: boolean;
  sendTime: string;
  timezone: string;
  selectedBlocks: ExecutivePushBlock[];
  blockOrder: ExecutivePushBlock[];
  updatedBy?: string;
  updatedAt: Date;
}

export interface ConfiguracionWhatsApp {
  prefijoTelefono: string;
}

export interface Configuracion {
  id: 'global';
  tasasCambio: TasasCambio;
  notificaciones: ConfiguracionNotificaciones;
  executivePush: ExecutivePushSettings;
  whatsapp: ConfiguracionWhatsApp;
  updatedAt: Date;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
  userAgent: string;
  lastSeenAt: Date;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutivePushSummaryBlock {
  key: ExecutivePushBlock;
  label: string;
  count?: number;
  amount?: number;
  currency?: string;
  destination: string;
  tab?: string;
}

export interface ExecutivePushSummaryPayload {
  kind: 'executive_daily_summary';
  title: string;
  body: string;
  destination: string;
  tab?: string;
  blocks: ExecutivePushSummaryBlock[];
  generatedAt: string;
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
