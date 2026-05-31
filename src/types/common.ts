// ===========================
// COMMON TYPES
// ===========================

// Activity Log Types
export type AccionLog = 'creacion' | 'actualizacion' | 'corte' | 'eliminacion' | 'renovacion' | 'reembolso';
export type EntidadLog = 'cliente' | 'revendedor' | 'servicio' | 'tercero' | 'categoria' | 'metodo_pago' | 'gasto' | 'venta' | 'template';

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
  | 'servicios_por_pagar'
  | 'reposo_terminado'
  | 'monto_a_fondear';

export interface ExecutivePushSettings {
  enabled: boolean;
  sendTime: string;
  windowStart: string;
  windowEnd: string;
  intervalHours: number;
  timezone: string;
  selectedBlocks: ExecutivePushBlock[];
  blockOrder: ExecutivePushBlock[];
  updatedBy?: string;
  updatedAt: Date;
  lastSentAt?: Date | null;
  lastSentDate?: string | null;
  lastSentSlot?: string | null;
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
  // Multi-currency totals: { USD: 50, NGN: 1500, EGP: 200 }. Empty object means
  // no services match the criteria — the body will still render "0".
  amounts?: Record<string, number>;
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
export type TipoTemplate =
  | 'notificacion_regular'
  | 'dia_pago'
  | 'renovacion'
  | 'suscripcion'
  | 'cancelacion'
  | 'actualizacion_credenciales'
  | 'transferencia_servicio';

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
